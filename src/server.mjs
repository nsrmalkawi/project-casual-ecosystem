import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Pool } from "pg";
import ExcelJS from "exceljs";
import { stringify } from "csv-stringify/sync";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config(); // Load environment variables from .env file

// --- Configuration ---

const app = express();
app.use(cors()); // Allow frontend to call the API from a different origin during dev/prod
app.use(express.json({ limit: "5mb" })); // Parse JSON requests
const port = process.env.PORT || 3001;

// API key for the public Google AI endpoint (Gemini).
const GEMINI_API_KEY =
  process.env.VITE_GOOGLE_CLOUD_API_KEY ||
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error("Missing Google AI API key. Set VITE_GOOGLE_CLOUD_API_KEY or GEMINI_API_KEY.");
}

// Model selection: normalize any legacy model names, try requested first, then fall back.
// See https://ai.google.dev/gemini-api/docs/models for available names.
const LEGACY_MODEL_MAP = {
  "gemini-1.5-flash-002": "gemini-1.5-flash",
  "gemini-1.5-pro-002": "gemini-1.5-pro",
};

function normalizeModelName(name) {
  if (!name) return null;
  const trimmed = String(name).trim();
  return LEGACY_MODEL_MAP[trimmed] || trimmed;
}

const PRIMARY_MODEL =
  normalizeModelName(process.env.VITE_GOOGLE_CLOUD_MODEL) ||
  normalizeModelName(process.env.GOOGLE_AI_MODEL) ||
  "gemini-2.5-flash";

const FALLBACK_MODELS = [
  // Only keep supported, lightweight fallbacks (remove 1.5 to avoid 404s)
  "gemini-2.0-flash",
];

const DATABASE_URL = process.env.DATABASE_URL;
let pool = null;

if (DATABASE_URL) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
} else {
  console.warn("DATABASE_URL not set; export endpoints will return 503.");
}

const EXPORTABLE_TABLES = new Set([
  "sales",
  "purchases",
  "waste",
  "recipe_waste",
  "inventory_items",
  "rent_opex",
  "hr_payroll",
  "petty_cash",
  // NEW: HR exports
  "hr_employees",
  "hr_attendance",
  "hr_assessments",
  "hr_sops",
  "hr_employee_sops",
]);

// NEW: HR helpers for attendance/labor cost
const STANDARD_DAILY_HOURS = 8;
const STANDARD_MONTHLY_HOURS = 173.33; // ~40h/week * 52 / 12

function parseTimeToMinutes(str) {
  if (!str) return null;
  const [h, m] = String(str).split(":").map((n) => Number(n));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function computeHours({ startTime, endTime, totalHours, overtimeHours }) {
  let total = Number(totalHours) || 0;
  let overtime = Number(overtimeHours) || 0;

  const startMin = parseTimeToMinutes(startTime);
  const endMin = parseTimeToMinutes(endTime);
  if (startMin != null && endMin != null && endMin >= startMin) {
    const diff = (endMin - startMin) / 60;
    total = diff;
    overtime = Math.max(0, diff - STANDARD_DAILY_HOURS);
  }

  return { total, overtime };
}

function deriveHourlyRate({ hourlyRate, monthlySalary }) {
  const hourly = Number(hourlyRate);
  if (!Number.isNaN(hourly) && hourly > 0) return hourly;
  const monthly = Number(monthlySalary);
  if (!Number.isNaN(monthly) && monthly > 0) {
    return monthly / STANDARD_MONTHLY_HOURS;
  }
  return 0;
}

// --- Simple reporting endpoints ---
// Sales summary by brand/outlet/date range
app.get("/api/reports/sales-summary", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const { from, to, brand, outlet } = req.query || {};
  const filters = [];
  const params = [];
  let idx = 1;

  if (from) {
    filters.push(`date >= $${idx++}`);
    params.push(from);
  }
  if (to) {
    filters.push(`date <= $${idx++}`);
    params.push(to);
  }
  if (brand) {
    filters.push(`brand = $${idx++}`);
    params.push(brand);
  }
  if (outlet) {
    filters.push(`outlet = $${idx++}`);
    params.push(outlet);
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  try {
    const { rows } = await pool.query(
      `
        SELECT
          COALESCE(SUM(gross_sales),0) AS grossSales,
          COALESCE(SUM(net_sales),0)   AS netSales,
          COALESCE(SUM(discounts),0)   AS discounts,
          COALESCE(SUM(orders),0)      AS orders,
          COALESCE(SUM(covers),0)      AS covers
        FROM sales
        ${where}
      `,
      params
    );
    res.json({ ok: true, summary: rows[0] || {} });
  } catch (err) {
    console.error("Sales summary error:", err);
    res.status(500).json({ error: "REPORT_FAILED", message: err.message });
  }
});

// Purchases summary
app.get("/api/reports/purchases-summary", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const { from, to, brand, outlet, supplier, category } = req.query || {};
  const filters = [];
  const params = [];
  let idx = 1;

  if (from) {
    filters.push(`date >= $${idx++}`);
    params.push(from);
  }
  if (to) {
    filters.push(`date <= $${idx++}`);
    params.push(to);
  }
  if (brand) {
    filters.push(`brand = $${idx++}`);
    params.push(brand);
  }
  if (outlet) {
    filters.push(`outlet = $${idx++}`);
    params.push(outlet);
  }
  if (supplier) {
    filters.push(`supplier = $${idx++}`);
    params.push(supplier);
  }
  if (category) {
    filters.push(`category = $${idx++}`);
    params.push(category);
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  try {
    const { rows } = await pool.query(
      `
        SELECT
          COALESCE(SUM(total_cost),0) AS totalCost,
          COALESCE(SUM(quantity),0)    AS quantity
        FROM purchases
        ${where}
      `,
      params
    );
    res.json({ ok: true, summary: rows[0] || {} });
  } catch (err) {
    console.error("Purchases summary error:", err);
    res.status(500).json({ error: "REPORT_FAILED", message: err.message });
  }
});

// Waste summary
app.get("/api/reports/waste-summary", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const { from, to, brand, outlet, category, reason } = req.query || {};
  const filters = [];
  const params = [];
  let idx = 1;

  if (from) {
    filters.push(`date >= $${idx++}`);
    params.push(from);
  }
  if (to) {
    filters.push(`date <= $${idx++}`);
    params.push(to);
  }
  if (brand) {
    filters.push(`brand = $${idx++}`);
    params.push(brand);
  }
  if (outlet) {
    filters.push(`outlet = $${idx++}`);
    params.push(outlet);
  }
  if (category) {
    filters.push(`category = $${idx++}`);
    params.push(category);
  }
  if (reason) {
    filters.push(`reason = $${idx++}`);
    params.push(reason);
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  try {
    const { rows } = await pool.query(
      `
        SELECT
          COALESCE(SUM(total_cost),0) AS totalCost,
          COALESCE(SUM(quantity),0)    AS quantity
        FROM waste
        ${where}
      `,
      params
    );
    res.json({ ok: true, summary: rows[0] || {} });
  } catch (err) {
    console.error("Waste summary error:", err);
    res.status(500).json({ error: "REPORT_FAILED", message: err.message });
  }
});

// HR / payroll summary
app.get("/api/reports/hr-summary", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const { from, to, brand, outlet, role } = req.query || {};
  const filters = [];
  const params = [];
  let idx = 1;

  if (from) {
    filters.push(`date >= $${idx++}`);
    params.push(from);
  }
  if (to) {
    filters.push(`date <= $${idx++}`);
    params.push(to);
  }
  if (brand) {
    filters.push(`brand = $${idx++}`);
    params.push(brand);
  }
  if (outlet) {
    filters.push(`outlet = $${idx++}`);
    params.push(outlet);
  }
  if (role) {
    filters.push(`role = $${idx++}`);
    params.push(role);
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  try {
    const { rows } = await pool.query(
      `
        SELECT
          COALESCE(SUM(hours),0)       AS hours,
          COALESCE(SUM(base_pay),0)    AS basePay,
          COALESCE(SUM(overtime_pay),0) AS overtimePay,
          COALESCE(SUM(other_pay),0)    AS otherPay,
          COALESCE(SUM(labor_cost),0)   AS laborCost
        FROM hr_payroll
        ${where}
      `,
      params
    );
    res.json({ ok: true, summary: rows[0] || {} });
  } catch (err) {
    console.error("HR summary error:", err);
    res.status(500).json({ error: "REPORT_FAILED", message: err.message });
  }
});

// Rent/Opex summary
app.get("/api/reports/rent-opex-summary", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const { from, to, brand, outlet, category } = req.query || {};
  const filters = [];
  const params = [];
  let idx = 1;

  if (from) {
    filters.push(`date >= $${idx++}`);
    params.push(from);
  }
  if (to) {
    filters.push(`date <= $${idx++}`);
    params.push(to);
  }
  if (brand) {
    filters.push(`brand = $${idx++}`);
    params.push(brand);
  }
  if (outlet) {
    filters.push(`outlet = $${idx++}`);
    params.push(outlet);
  }
  if (category) {
    filters.push(`category = $${idx++}`);
    params.push(category);
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  try {
    const { rows } = await pool.query(
      `
        SELECT COALESCE(SUM(amount),0) AS amount
        FROM rent_opex
        ${where}
      `,
      params
    );
    res.json({ ok: true, summary: rows[0] || {} });
  } catch (err) {
    console.error("Rent/opex summary error:", err);
    res.status(500).json({ error: "REPORT_FAILED", message: err.message });
  }
});

// Petty cash summary
app.get("/api/reports/petty-cash-summary", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const { from, to, brand, outlet, category } = req.query || {};
  const filters = [];
  const params = [];
  let idx = 1;

  if (from) {
    filters.push(`date >= $${idx++}`);
    params.push(from);
  }
  if (to) {
    filters.push(`date <= $${idx++}`);
    params.push(to);
  }
  if (brand) {
    filters.push(`brand = $${idx++}`);
    params.push(brand);
  }
  if (outlet) {
    filters.push(`outlet = $${idx++}`);
    params.push(outlet);
  }
  if (category) {
    filters.push(`category = $${idx++}`);
    params.push(category);
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  try {
    const { rows } = await pool.query(
      `
        SELECT COALESCE(SUM(amount),0) AS amount
        FROM petty_cash
        ${where}
      `,
      params
    );
    res.json({ ok: true, summary: rows[0] || {} });
  } catch (err) {
    console.error("Petty cash summary error:", err);
    res.status(500).json({ error: "REPORT_FAILED", message: err.message });
  }
});

// Inventory summary (counts items, optional category/brand filters)
app.get("/api/reports/inventory-summary", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const { category, brand } = req.query || {};
  const filters = [];
  const params = [];
  let idx = 1;

  if (category) {
    filters.push(`category = $${idx++}`);
    params.push(category);
  }
  if (brand) {
    filters.push(`brand = $${idx++}`);
    params.push(brand);
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  try {
    const { rows } = await pool.query(
      `
        SELECT
          COUNT(*) AS itemCount,
          COALESCE(SUM(current_qty),0) AS totalQty,
          COALESCE(AVG(last_cost),0) AS avgLastCost
        FROM inventory_items
        ${where}
      `,
      params
    );
    res.json({ ok: true, summary: rows[0] || {} });
  } catch (err) {
    console.error("Inventory summary error:", err);
    res.status(500).json({ error: "REPORT_FAILED", message: err.message });
  }
});


async function callGemini(text) {
  if (typeof fetch !== "function") {
    throw new Error("Global fetch is unavailable. Please use Node 18+ or add a fetch polyfill.");
  }

  const modelsToTry = [PRIMARY_MODEL, ...FALLBACK_MODELS];
  let lastErr = null;
  const attempts = [];

  for (const model of modelsToTry) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text }] }],
        }),
      });

      if (!resp.ok) {
        const errBody = await resp.text();
        const errMessage = `Gemini API error (${resp.status}) [${model}]: ${errBody}`;
        attempts.push({ model, status: resp.status });

        // Only retry on NOT_FOUND/404.
        if (resp.status === 404 || errBody.includes("NOT_FOUND")) {
          lastErr = new Error(errMessage);
          continue;
        }

        throw new Error(errMessage);
      }

      const data = await resp.json();
      const textParts =
        data?.candidates?.[0]?.content?.parts
          ?.map((part) => part.text)
          .filter(Boolean) || [];

      const joined = textParts.join("\n").trim();
      if (!joined) {
        throw new Error(`Gemini API returned empty content for model ${model}.`);
      }

      return { text: joined, model };
    } catch (err) {
      lastErr = err;
      attempts.push({ model, error: err.message });
    }
  }

  console.error("Gemini call failed after attempts:", attempts);
  throw lastErr || new Error("Gemini API call failed without a specific error.");
}

/**
 * Generic handler for AI requests from the client.
 * It takes a system prompt and a user payload to generate content.
 */
async function handleAiRequest(req, res, systemPrompt) {
  const { payload, question } = req.body;

  if (!payload) {
    return res.status(400).json({ error: "Missing payload in request body" });
  }

  try {
    const text = `
      System Prompt: ${systemPrompt}

      User Question (optional): ${question || "N/A"}

      JSON Data:
      ${JSON.stringify(payload, null, 2)}
    `;

    const { text: responseText, model: usedModel } = await callGemini(text);

    if (!responseText) {
      return res
        .status(500)
        .json({ error: "AI_EMPTY_RESPONSE", message: "The AI returned an empty or invalid response." });
    }

    res.json({ text: responseText, model: usedModel });
  } catch (error) {
    console.error("Error calling Google AI:", error);
    res.status(500).json({ error: "AI_REQUEST_FAILED", message: error.message });
  }
}

// --- API Endpoints ---

app.post("/api/ai-explanation", (req, res) => {
  const systemPrompt =
    "You are a senior F&B analyst. Provide a structured markdown explanation with short sections: ## Snapshot (key numbers), ## What it means (2-3 bullets), ## Risks (2-3 bullets), ## Actions (3-5 bullets). Be concise and manager-friendly.";
  handleAiRequest(req, res, systemPrompt);
});

app.post("/api/ai-report", (req, res) => {
  const systemPrompt =
    "You are a senior F&B performance analyst. Generate a structured markdown report with sections (Summary, Risks/Anomalies, Actions), and include at least one markdown table summarizing top outlets/brands with Sales, Food%, Labor%, EBITDA. Keep it concise and actionable.";
  handleAiRequest(req, res, systemPrompt);
});

app.post("/api/ai-menu-actions", (req, res) => {
  const systemPrompt =
    "You are a menu engineering expert. Return markdown with: ## Top 3 items to promote, ## Top 3 to fix/remove, and a markdown table with Item | Class (Star/Plowhorse/Puzzle/Dog) | Price | Cost | Margin% | Action. Keep it concise and actionable.";
  handleAiRequest(req, res, systemPrompt);
});

// Basic health check to confirm server is up and envs are wired.
app.get("/api/health", (_req, res) => {
  try {
    res.json({
      ok: true,
      model: PRIMARY_MODEL,
      fallbacks: FALLBACK_MODELS,
      hasApiKey: !!GEMINI_API_KEY,
      hasDatabase: !!pool,
      env: process.env.NODE_ENV || "development",
    });
  } catch (err) {
    console.error("Health endpoint error:", err);
    res.status(500).json({ error: "HEALTH_FAILED", message: err.message });
  }
});

// Persist sales rows into Postgres
app.post("/api/sales", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const {
    date,
    brand,
    outlet,
    channel,
    orders,
    covers,
    grossSales,
    discounts,
    netSales,
    vat,
    deliveryFees,
    notes,
  } = req.body || {};

  if (!date || !brand || !outlet || !channel || orders == null || grossSales == null || netSales == null) {
    return res.status(400).json({ error: "MISSING_FIELDS" });
  }

  try {
    await pool.query(
      `INSERT INTO sales (
        date, brand, outlet, channel, orders, covers,
        gross_sales, discounts, net_sales, vat, delivery_fees, notes
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        date,
        brand,
        outlet,
        channel,
        orders,
        covers || null,
        grossSales,
        discounts || null,
        netSales,
        vat || null,
        deliveryFees || null,
        notes || null,
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("Insert sales error:", err);
    res.status(500).json({ error: "INSERT_FAILED", message: err.message });
  }
});

// Fetch sales rows from Postgres
app.get("/api/sales", async (_req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, date, brand, outlet, channel, orders, covers,
              gross_sales AS "grossSales",
              discounts,
              net_sales AS "netSales",
              vat,
              delivery_fees AS "deliveryFees",
              notes
       FROM sales
       ORDER BY date DESC NULLS LAST, created_at DESC NULLS LAST
       LIMIT 500`
    );
    res.json({ ok: true, rows });
  } catch (err) {
    console.error("Fetch sales error:", err);
    res.status(500).json({ error: "FETCH_FAILED", message: err.message });
  }
});

// Persist purchases rows into Postgres
app.post("/api/purchases", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const {
    date,
    brand,
    outlet,
    supplier,
    category,
    itemName,
    unit,
    quantity,
    unitCost,
    totalCost,
    invoiceNo,
    paymentTerm,
    notes,
  } = req.body || {};

  if (
    !date ||
    !brand ||
    !outlet ||
    !supplier ||
    !category ||
    !itemName ||
    !unit ||
    quantity == null ||
    unitCost == null ||
    totalCost == null
  ) {
    return res.status(400).json({ error: "MISSING_FIELDS" });
  }

  try {
    await pool.query(
      `INSERT INTO purchases (
        date, brand, outlet, supplier, category, item_name, unit,
        quantity, unit_cost, total_cost, invoice_no, payment_term, notes
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        date,
        brand,
        outlet,
        supplier,
        category,
        itemName,
        unit,
        quantity,
        unitCost,
        totalCost,
        invoiceNo || null,
        paymentTerm || null,
        notes || null,
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("Insert purchases error:", err);
    res.status(500).json({ error: "INSERT_FAILED", message: err.message });
  }
});

// Fetch purchases rows
app.get("/api/purchases", async (_req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, date, brand, outlet, supplier, category, item_name AS "itemName",
              unit, quantity, unit_cost AS "unitCost", total_cost AS "totalCost",
              invoice_no AS "invoiceNo", payment_term AS "paymentTerm", notes
       FROM purchases
       ORDER BY date DESC NULLS LAST, created_at DESC NULLS LAST
       LIMIT 500`
    );
    res.json({ ok: true, rows });
  } catch (err) {
    console.error("Fetch purchases error:", err);
    res.status(500).json({ error: "FETCH_FAILED", message: err.message });
  }
});

// Fetch purchases rows
app.get("/api/purchases", async (_req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, date, brand, outlet, supplier, category, item_name AS "itemName",
              unit, quantity, unit_cost AS "unitCost", total_cost AS "totalCost",
              invoice_no AS "invoiceNo", payment_term AS "paymentTerm", notes
       FROM purchases
       ORDER BY date DESC NULLS LAST, created_at DESC NULLS LAST
       LIMIT 500`
    );
    res.json({ ok: true, rows });
  } catch (err) {
    console.error("Fetch purchases error:", err);
    res.status(500).json({ error: "FETCH_FAILED", message: err.message });
  }
});

// Persist waste rows into Postgres
app.post("/api/waste", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const {
    date,
    brand,
    outlet,
    category,
    itemName,
    reason,
    quantity,
    unit,
    unitCost,
    totalCost,
    notes,
  } = req.body || {};

  if (
    !date ||
    !brand ||
    !outlet ||
    !category ||
    !itemName ||
    !reason ||
    quantity == null ||
    !unit ||
    unitCost == null ||
    totalCost == null
  ) {
    return res.status(400).json({ error: "MISSING_FIELDS" });
  }

  try {
    await pool.query(
      `INSERT INTO waste (
        date, brand, outlet, category, item_name, reason,
        quantity, unit, unit_cost, total_cost, notes
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        date,
        brand,
        outlet,
        category,
        itemName,
        reason,
        quantity,
        unit,
        unitCost,
        totalCost,
        notes || null,
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("Insert waste error:", err);
    res.status(500).json({ error: "INSERT_FAILED", message: err.message });
  }
});

// Fetch waste rows
app.get("/api/waste", async (_req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, date, brand, outlet, category, item_name AS "itemName",
              reason, quantity, unit, unit_cost AS "unitCost",
              total_cost AS "totalCost", notes
       FROM waste
       ORDER BY date DESC NULLS LAST, created_at DESC NULLS LAST
       LIMIT 500`
    );
    res.json({ ok: true, rows });
  } catch (err) {
    console.error("Fetch waste error:", err);
    res.status(500).json({ error: "FETCH_FAILED", message: err.message });
  }
});

// Fetch waste rows
app.get("/api/waste", async (_req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, date, brand, outlet, category, item_name AS "itemName",
              reason, quantity, unit, unit_cost AS "unitCost",
              total_cost AS "totalCost", notes
       FROM waste
       ORDER BY date DESC NULLS LAST, created_at DESC NULLS LAST
       LIMIT 500`
    );
    res.json({ ok: true, rows });
  } catch (err) {
    console.error("Fetch waste error:", err);
    res.status(500).json({ error: "FETCH_FAILED", message: err.message });
  }
});

// Persist HR / payroll rows into Postgres
app.post("/api/hr-payroll", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const {
    date,
    brand,
    outlet,
    employeeName,
    role,
    hours,
    hourlyRate,
    basePay,
    overtimePay,
    otherPay,
    laborCost,
    notes,
  } = req.body || {};

  if (
    !date ||
    !brand ||
    !outlet ||
    !employeeName ||
    !role ||
    hours == null ||
    basePay == null ||
    laborCost == null
  ) {
    return res.status(400).json({ error: "MISSING_FIELDS" });
  }

  try {
    await pool.query(
      `INSERT INTO hr_payroll (
        date, brand, outlet, employee_name, role, hours,
        hourly_rate, base_pay, overtime_pay, other_pay, labor_cost, notes
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        date,
        brand,
        outlet,
        employeeName,
        role,
        hours,
        hourlyRate || null,
        basePay,
        overtimePay || null,
        otherPay || null,
        laborCost,
        notes || null,
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("Insert hr_payroll error:", err);
    res.status(500).json({ error: "INSERT_FAILED", message: err.message });
  }
});

// Fetch HR / payroll rows
app.get("/api/hr-payroll", async (_req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, date, brand, outlet, employee_name AS "employeeName", role,
              hours, hourly_rate AS "hourlyRate", base_pay AS "basePay",
              overtime_pay AS "overtimePay", other_pay AS "otherPay",
              labor_cost AS "laborCost", notes
       FROM hr_payroll
       ORDER BY date DESC NULLS LAST, created_at DESC NULLS LAST
       LIMIT 500`
    );
    res.json({ ok: true, rows });
  } catch (err) {
    console.error("Fetch hr_payroll error:", err);
    res.status(500).json({ error: "FETCH_FAILED", message: err.message });
  }
});

// Persist inventory items
app.post("/api/inventory-items", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const {
    itemCode,
    itemName,
    category,
    brand,
    defaultOutlet,
    unit,
    parLevel,
    minLevel,
    lastCost,
    avgCost,
    currentQty,
    notes,
  } = req.body || {};

  if (!itemCode || !itemName || !category || !unit || lastCost == null) {
    return res.status(400).json({ error: "MISSING_FIELDS" });
  }

  try {
    await pool.query(
      `INSERT INTO inventory_items (
        item_code, item_name, category, brand, default_outlet, unit,
        par_level, min_level, last_cost, avg_cost, current_qty, notes
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        itemCode,
        itemName,
        category,
        brand || null,
        defaultOutlet || null,
        unit,
        parLevel || null,
        minLevel || null,
        lastCost,
        avgCost || null,
        currentQty || null,
        notes || null,
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("Insert inventory_items error:", err);
    res.status(500).json({ error: "INSERT_FAILED", message: err.message });
  }
});

// Fetch inventory items
app.get("/api/inventory-items", async (_req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, item_code AS "itemCode", item_name AS "itemName",
              category, brand, default_outlet AS "defaultOutlet", unit,
              par_level AS "parLevel", min_level AS "minLevel",
              last_cost AS "lastCost", avg_cost AS "avgCost",
              current_qty AS "currentQty", notes
       FROM inventory_items
       ORDER BY item_name ASC
       LIMIT 500`
    );
    res.json({ ok: true, rows });
  } catch (err) {
    console.error("Fetch inventory_items error:", err);
    res.status(500).json({ error: "FETCH_FAILED", message: err.message });
  }
});

// Persist rent/opex rows
app.post("/api/rent-opex", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const { date, brand, outlet, category, description, amount, notes } = req.body || {};

  if (!date || !brand || !outlet || !category || !description || amount == null) {
    return res.status(400).json({ error: "MISSING_FIELDS" });
  }

  try {
    await pool.query(
      `INSERT INTO rent_opex (date, brand, outlet, category, description, amount, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [date, brand, outlet, category, description, amount, notes || null]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("Insert rent_opex error:", err);
    res.status(500).json({ error: "INSERT_FAILED", message: err.message });
  }
});

// Fetch rent/opex
app.get("/api/rent-opex", async (_req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, date, brand, outlet, category, description, amount, notes
       FROM rent_opex
       ORDER BY date DESC NULLS LAST, created_at DESC NULLS LAST
       LIMIT 500`
    );
    res.json({ ok: true, rows });
  } catch (err) {
    console.error("Fetch rent_opex error:", err);
    res.status(500).json({ error: "FETCH_FAILED", message: err.message });
  }
});

// Persist petty cash
app.post("/api/petty-cash", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const { date, brand, outlet, category, description, amount, notes } = req.body || {};

  if (!date || !brand || !outlet || !category || !description || amount == null) {
    return res.status(400).json({ error: "MISSING_FIELDS" });
  }

  try {
    await pool.query(
      `INSERT INTO petty_cash (date, brand, outlet, category, description, amount, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [date, brand, outlet, category, description, amount, notes || null]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("Insert petty_cash error:", err);
    res.status(500).json({ error: "INSERT_FAILED", message: err.message });
  }
});

// Fetch petty cash
app.get("/api/petty-cash", async (_req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, date, brand, outlet, category, description, amount, notes
       FROM petty_cash
       ORDER BY date DESC NULLS LAST, created_at DESC NULLS LAST
       LIMIT 500`
    );
    res.json({ ok: true, rows });
  } catch (err) {
    console.error("Fetch petty_cash error:", err);
    res.status(500).json({ error: "FETCH_FAILED", message: err.message });
  }
});

// Fetch HR / payroll rows
app.get("/api/hr-payroll", async (_req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, date, brand, outlet, employee_name AS "employeeName", role,
              hours, hourly_rate AS "hourlyRate", base_pay AS "basePay",
              overtime_pay AS "overtimePay", other_pay AS "otherPay",
              labor_cost AS "laborCost", notes
       FROM hr_payroll
       ORDER BY date DESC NULLS LAST, created_at DESC NULLS LAST
       LIMIT 500`
    );
    res.json({ ok: true, rows });
  } catch (err) {
    console.error("Fetch hr_payroll error:", err);
    res.status(500).json({ error: "FETCH_FAILED", message: err.message });
  }
});

// NEW: HR employees CRUD
app.get("/api/hr/employees", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const { q, outlet, status } = req.query || {};
  const filters = [];
  const params = [];
  let idx = 1;

  if (q) {
    filters.push(
      `(LOWER(name) LIKE $${idx} OR LOWER(employee_id) LIKE $${idx} OR LOWER(role) LIKE $${idx})`
    );
    params.push(`%${q.toLowerCase()}%`);
    idx += 1;
  }
  if (outlet) {
    filters.push(`outlet = $${idx++}`);
    params.push(outlet);
  }
  if (status) {
    filters.push(`status = $${idx++}`);
    params.push(status);
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  try {
    const { rows } = await pool.query(
      `
        SELECT
          id,
          employee_id AS "employeeId",
          name,
          role,
          outlet,
          status,
          start_date AS "startDate",
          hourly_rate AS "hourlyRate",
          monthly_salary AS "monthlySalary",
          overtime_rate AS "overtimeRate",
          contact,
          notes,
          created_at AS "createdAt"
        FROM hr_employees
        ${where}
        ORDER BY name ASC NULLS LAST
        LIMIT 500
      `,
      params
    );
    res.json({ ok: true, records: rows });
  } catch (err) {
    console.error("Fetch hr_employees error:", err);
    res.status(500).json({ error: "FETCH_FAILED", message: err.message });
  }
});

app.post("/api/hr/employees", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const {
    employeeId,
    name,
    role,
    outlet,
    status = "Active",
    startDate,
    hourlyRate,
    monthlySalary,
    overtimeRate,
    contact,
    notes,
  } = req.body || {};

  if (!name || !role || !outlet) {
    return res.status(400).json({ error: "MISSING_FIELDS" });
  }

  try {
    const { rows } = await pool.query(
      `
        INSERT INTO hr_employees (
          employee_id, name, role, outlet, status, start_date,
          hourly_rate, monthly_salary, overtime_rate, contact, notes
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING id
      `,
      [
        employeeId || null,
        name,
        role,
        outlet,
        status,
        startDate || null,
        hourlyRate || null,
        monthlySalary || null,
        overtimeRate || null,
        contact || null,
        notes || null,
      ]
    );
    res.json({ ok: true, id: rows[0]?.id });
  } catch (err) {
    console.error("Insert hr_employees error:", err);
    res.status(500).json({ error: "INSERT_FAILED", message: err.message });
  }
});

app.put("/api/hr/employees/:id", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const id = req.params.id;
  const {
    employeeId,
    name,
    role,
    outlet,
    status,
    startDate,
    hourlyRate,
    monthlySalary,
    overtimeRate,
    contact,
    notes,
  } = req.body || {};

  try {
    await pool.query(
      `
        UPDATE hr_employees
        SET employee_id=$1, name=$2, role=$3, outlet=$4, status=$5, start_date=$6,
            hourly_rate=$7, monthly_salary=$8, overtime_rate=$9, contact=$10, notes=$11
        WHERE id=$12
      `,
      [
        employeeId || null,
        name || null,
        role || null,
        outlet || null,
        status || null,
        startDate || null,
        hourlyRate || null,
        monthlySalary || null,
        overtimeRate || null,
        contact || null,
        notes || null,
        id,
      ]
    );
    res.json({ ok: true, id });
  } catch (err) {
    console.error("Update hr_employees error:", err);
    res.status(500).json({ error: "UPDATE_FAILED", message: err.message });
  }
});

// NEW: HR attendance CRUD + labor KPI
app.get("/api/hr/attendance", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const { from, to, outlet, employeeId } = req.query || {};
  const filters = [];
  const params = [];
  let idx = 1;

  if (from) {
    filters.push(`a.date >= $${idx++}`);
    params.push(from);
  }
  if (to) {
    filters.push(`a.date <= $${idx++}`);
    params.push(to);
  }
  if (outlet) {
    filters.push(`a.outlet = $${idx++}`);
    params.push(outlet);
  }
  if (employeeId) {
    filters.push(`a.employee_id = $${idx++}`);
    params.push(employeeId);
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  try {
    const { rows } = await pool.query(
      `
        SELECT
          a.id,
          a.date,
          a.employee_id AS "employeeId",
          e.name AS "employeeName",
          COALESCE(a.outlet, e.outlet) AS outlet,
          a.start_time AS "startTime",
          a.end_time AS "endTime",
          a.total_hours AS "totalHours",
          a.overtime_hours AS "overtimeHours",
          a.notes,
          a.created_at AS "createdAt"
        FROM hr_attendance a
        LEFT JOIN hr_employees e ON e.id = a.employee_id
        ${where}
        ORDER BY a.date DESC NULLS LAST, a.created_at DESC NULLS LAST
        LIMIT 500
      `,
      params
    );
    res.json({ ok: true, records: rows });
  } catch (err) {
    console.error("Fetch hr_attendance error:", err);
    res.status(500).json({ error: "FETCH_FAILED", message: err.message });
  }
});

app.post("/api/hr/attendance", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const { date, employeeId, outlet, startTime, endTime, totalHours, overtimeHours, notes } =
    req.body || {};

  if (!date || !employeeId) {
    return res.status(400).json({ error: "MISSING_FIELDS" });
  }

  const { total, overtime } = computeHours({ startTime, endTime, totalHours, overtimeHours });

  try {
    const { rows } = await pool.query(
      `
        INSERT INTO hr_attendance (
          date, employee_id, outlet, start_time, end_time,
          total_hours, overtime_hours, notes
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING id
      `,
      [
        date,
        employeeId,
        outlet || null,
        startTime || null,
        endTime || null,
        total,
        overtime,
        notes || null,
      ]
    );
    res.json({ ok: true, id: rows[0]?.id });
  } catch (err) {
    console.error("Insert hr_attendance error:", err);
    res.status(500).json({ error: "INSERT_FAILED", message: err.message });
  }
});

app.put("/api/hr/attendance/:id", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const id = req.params.id;
  const { date, employeeId, outlet, startTime, endTime, totalHours, overtimeHours, notes } =
    req.body || {};

  const { total, overtime } = computeHours({ startTime, endTime, totalHours, overtimeHours });

  try {
    await pool.query(
      `
        UPDATE hr_attendance
        SET date=$1, employee_id=$2, outlet=$3, start_time=$4, end_time=$5,
            total_hours=$6, overtime_hours=$7, notes=$8
        WHERE id=$9
      `,
      [
        date || null,
        employeeId || null,
        outlet || null,
        startTime || null,
        endTime || null,
        total,
        overtime,
        notes || null,
        id,
      ]
    );
    res.json({ ok: true, id });
  } catch (err) {
    console.error("Update hr_attendance error:", err);
    res.status(500).json({ error: "UPDATE_FAILED", message: err.message });
  }
});

app.get("/api/hr/labor-kpi", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const { from, to, outlet } = req.query || {};
  const filters = [];
  const params = [];
  let idx = 1;

  if (from) {
    filters.push(`a.date >= $${idx++}`);
    params.push(from);
  }
  if (to) {
    filters.push(`a.date <= $${idx++}`);
    params.push(to);
  }
  if (outlet) {
    filters.push(`COALESCE(a.outlet, e.outlet) = $${idx++}`);
    params.push(outlet);
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  try {
    const { rows } = await pool.query(
      `
        SELECT
          COALESCE(a.outlet, e.outlet) AS outlet,
          a.employee_id AS "employeeId",
          e.name AS "employeeName",
          SUM(a.total_hours) AS "totalHours",
          SUM(a.overtime_hours) AS "overtimeHours",
          SUM(
            a.total_hours * COALESCE(e.hourly_rate, e.monthly_salary / ${STANDARD_MONTHLY_HOURS})
            + a.overtime_hours * COALESCE(e.overtime_rate, COALESCE(e.hourly_rate, e.monthly_salary / ${STANDARD_MONTHLY_HOURS}) * 1.5)
          ) AS "laborCost"
        FROM hr_attendance a
        LEFT JOIN hr_employees e ON e.id = a.employee_id
        ${where}
        GROUP BY COALESCE(a.outlet, e.outlet), a.employee_id, e.name
      `,
      params
    );

    const totalLaborCost = rows.reduce((sum, r) => sum + Number(r.laborCost || 0), 0);
    const totalHours = rows.reduce((sum, r) => sum + Number(r.totalHours || 0), 0);
    const totalOvertimeHours = rows.reduce((sum, r) => sum + Number(r.overtimeHours || 0), 0);

    // Pull net sales for the same period/outlet to compute labor %
    let salesFilters = [];
    let salesParams = [];
    let sIdx = 1;
    if (from) {
      salesFilters.push(`date >= $${sIdx++}`);
      salesParams.push(from);
    }
    if (to) {
      salesFilters.push(`date <= $${sIdx++}`);
      salesParams.push(to);
    }
    if (outlet) {
      salesFilters.push(`outlet = $${sIdx++}`);
      salesParams.push(outlet);
    }
    const salesWhere = salesFilters.length ? `WHERE ${salesFilters.join(" AND ")}` : "";
    const salesResp = await pool.query(
      `SELECT COALESCE(SUM(net_sales),0) AS netSales FROM sales ${salesWhere}`,
      salesParams
    );
    const totalSales = Number(
      salesResp.rows?.[0]?.netsales ?? salesResp.rows?.[0]?.netSales ?? 0
    );

    const laborCostPctOfSales = totalSales > 0 ? (totalLaborCost / totalSales) * 100 : null;

    // Aggregate by outlet and employee
    const byOutletMap = new Map();
    rows.forEach((r) => {
      const key = r.outlet || "Unassigned";
      if (!byOutletMap.has(key)) {
        byOutletMap.set(key, { outlet: key, totalLaborCost: 0, totalHours: 0, overtimeHours: 0 });
      }
      const ref = byOutletMap.get(key);
      ref.totalLaborCost += Number(r.laborCost || 0);
      ref.totalHours += Number(r.totalHours || 0);
      ref.overtimeHours += Number(r.overtimeHours || 0);
    });

    res.json({
      ok: true,
      summary: {
        totalLaborCost,
        totalHours,
        totalOvertimeHours,
        totalSales,
        laborCostPctOfSales,
      },
      byOutlet: Array.from(byOutletMap.values()),
      byEmployee: rows,
    });
  } catch (err) {
    console.error("Labor KPI error:", err);
    res.status(500).json({ error: "REPORT_FAILED", message: err.message });
  }
});

// NEW: HR assessments
app.get("/api/hr/assessments", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const { employeeId, from, to } = req.query || {};
  const filters = [];
  const params = [];
  let idx = 1;

  if (employeeId) {
    filters.push(`a.employee_id = $${idx++}`);
    params.push(employeeId);
  }
  if (from) {
    filters.push(`a.review_date >= $${idx++}`);
    params.push(from);
  }
  if (to) {
    filters.push(`a.review_date <= $${idx++}`);
    params.push(to);
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  try {
    const { rows } = await pool.query(
      `
        SELECT
          a.id,
          a.employee_id AS "employeeId",
          e.name AS "employeeName",
          a.review_date AS "reviewDate",
          a.reviewer,
          a.overall_rating AS "overallRating",
          a.scores,
          a.comments,
          a.created_at AS "createdAt"
        FROM hr_assessments a
        LEFT JOIN hr_employees e ON e.id = a.employee_id
        ${where}
        ORDER BY a.review_date DESC NULLS LAST, a.created_at DESC NULLS LAST
        LIMIT 200
      `,
      params
    );
    res.json({ ok: true, records: rows });
  } catch (err) {
    console.error("Fetch hr_assessments error:", err);
    res.status(500).json({ error: "FETCH_FAILED", message: err.message });
  }
});

app.post("/api/hr/assessments", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const { employeeId, reviewDate, reviewer, overallRating, scores, comments } = req.body || {};
  if (!employeeId || !reviewDate || !reviewer) {
    return res.status(400).json({ error: "MISSING_FIELDS" });
  }

  try {
    const { rows } = await pool.query(
      `
        INSERT INTO hr_assessments (
          employee_id, review_date, reviewer, overall_rating, scores, comments
        )
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING id
      `,
      [employeeId, reviewDate, reviewer, overallRating || null, scores || null, comments || null]
    );
    res.json({ ok: true, id: rows[0]?.id });
  } catch (err) {
    console.error("Insert hr_assessments error:", err);
    res.status(500).json({ error: "INSERT_FAILED", message: err.message });
  }
});

// NEW: SOP library and employee acknowledgments
app.get("/api/hr/sops", async (_req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }
  try {
    const { rows } = await pool.query(
      `
        SELECT
          id,
          title,
          description,
          category,
          effective_date AS "effectiveDate",
          created_at AS "createdAt"
        FROM hr_sops
        ORDER BY effective_date DESC NULLS LAST, created_at DESC NULLS LAST
      `
    );
    res.json({ ok: true, records: rows });
  } catch (err) {
    console.error("Fetch hr_sops error:", err);
    res.status(500).json({ error: "FETCH_FAILED", message: err.message });
  }
});

app.get("/api/hr/sop-assignments", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const { employeeId } = req.query || {};
  const filters = [];
  const params = [];
  let idx = 1;
  if (employeeId) {
    filters.push(`es.employee_id = $${idx++}`);
    params.push(employeeId);
  }
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  try {
    const { rows } = await pool.query(
      `
        SELECT
          es.id,
          es.employee_id AS "employeeId",
          es.sop_id AS "sopId",
          s.title,
          s.category,
          es.assigned_date AS "assignedDate",
          es.acknowledged_date AS "acknowledgedDate",
          es.status,
          es.created_at AS "createdAt"
        FROM hr_employee_sops es
        LEFT JOIN hr_sops s ON s.id = es.sop_id
        ${where}
        ORDER BY es.created_at DESC NULLS LAST
      `,
      params
    );
    res.json({ ok: true, records: rows });
  } catch (err) {
    console.error("Fetch hr_employee_sops error:", err);
    res.status(500).json({ error: "FETCH_FAILED", message: err.message });
  }
});

app.post("/api/hr/sops/assign", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const { employeeId, sopId, assignedDate = new Date().toISOString().slice(0, 10), status = "Assigned" } =
    req.body || {};
  if (!employeeId || !sopId) {
    return res.status(400).json({ error: "MISSING_FIELDS" });
  }

  try {
    const update = await pool.query(
      `
        UPDATE hr_employee_sops
        SET assigned_date=$1, status=$2
        WHERE employee_id=$3 AND sop_id=$4
      `,
      [assignedDate, status, employeeId, sopId]
    );

    if (update.rowCount === 0) {
      await pool.query(
        `
          INSERT INTO hr_employee_sops (employee_id, sop_id, assigned_date, status)
          VALUES ($1,$2,$3,$4)
        `,
        [employeeId, sopId, assignedDate, status]
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Assign SOP error:", err);
    res.status(500).json({ error: "UPSERT_FAILED", message: err.message });
  }
});

app.post("/api/hr/sops/ack", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const { employeeId, sopId, acknowledgedDate = new Date().toISOString().slice(0, 10) } = req.body || {};
  if (!employeeId || !sopId) {
    return res.status(400).json({ error: "MISSING_FIELDS" });
  }

  try {
    const update = await pool.query(
      `
        UPDATE hr_employee_sops
        SET acknowledged_date=$1, status='Acknowledged'
        WHERE employee_id=$2 AND sop_id=$3
      `,
      [acknowledgedDate, employeeId, sopId]
    );

    if (update.rowCount === 0) {
      await pool.query(
        `
          INSERT INTO hr_employee_sops (employee_id, sop_id, assigned_date, acknowledged_date, status)
          VALUES ($1,$2,$3,$4,'Acknowledged')
        `,
        [employeeId, sopId, acknowledgedDate, acknowledgedDate]
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Acknowledge SOP error:", err);
    res.status(500).json({ error: "UPSERT_FAILED", message: err.message });
  }
});

// Export endpoints (CSV & XLSX)

app.get("/api/export/:table", async (req, res) => {
  if (!pool) {
    return res.status(503).json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const table = req.params.table;
  if (!EXPORTABLE_TABLES.has(table)) {
    return res.status(400).json({ error: "INVALID_TABLE" });
  }

  try {
    const { rows } = await pool.query(`SELECT * FROM ${table} ORDER BY date DESC NULLS LAST`);
    const csv = stringify(rows, { header: true });
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=${table}.csv`);
    res.send(csv);
  } catch (err) {
    console.error("CSV export error:", err);
    res.status(500).json({ error: "EXPORT_FAILED", message: err.message });
  }
});

app.get("/api/export-xlsx/:table", async (req, res) => {
  if (!pool) {
    return res.status(503).json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const table = req.params.table;
  if (!EXPORTABLE_TABLES.has(table)) {
    return res.status(400).json({ error: "INVALID_TABLE" });
  }

  try {
    const { rows, fields } = await pool.query(`SELECT * FROM ${table} ORDER BY date DESC NULLS LAST`);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(table);
    ws.columns = fields.map((f) => ({ header: f.name, key: f.name }));
    rows.forEach((r) => ws.addRow(r));

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename=${table}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("XLSX export error:", err);
    res.status(500).json({ error: "EXPORT_FAILED", message: err.message });
  }
});

// --- Serve built frontend (dist) for single-service deploys ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, "../dist");

app.use(express.static(distPath));
// Fallback for SPA routes that aren't handled above
app.use((_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(port, () => {
  console.log(
    `AI server listening on port ${port} | primary model=${PRIMARY_MODEL} | fallbacks=${FALLBACK_MODELS.join(
      ", "
    )} | hasApiKey=${!!GEMINI_API_KEY}`
  );
});
