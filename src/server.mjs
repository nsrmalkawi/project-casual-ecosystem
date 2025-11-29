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
app.use(express.json({ limit: "10mb" })); // Parse JSON requests (bumped for supplier workbook imports)
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
  // Suppliers & sourcing
  "supplier_comparison",
  "supplier_directory",
  "supplier_contacts",
  "supplier_kitchen_equipment",
  "supplier_packaging_disposables",
  "supplier_hotelware_ose",
  // Action plan (3M)
  "action_plan_3m",
]);

// Cache rent_opex columns to keep inserts/selects compatible if the DB hasn't been migrated yet.
let rentOpexColumns = null;
async function hasRentOpexColumn(name) {
  if (!pool) return false;
  if (!rentOpexColumns) {
    const { rows } = await pool.query(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'rent_opex'
      `
    );
    rentOpexColumns = new Set(rows.map((r) => r.column_name));
  }
  return rentOpexColumns.has(name);
}

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

// --- Suppliers & Sourcing helpers ---

function normalizeText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && value !== null) {
    if (value.text) return String(value.text).trim();
    if (value.result !== undefined) return String(value.result).trim();
    if (Array.isArray(value.richText)) {
      return value.richText.map((t) => t.text || "").join("").trim();
    }
  }
  return String(value).trim();
}

function numberOrNull(value) {
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function computeLowestPrice({ price1, price2, price3, fallback }) {
  const values = [price1, price2, price3]
    .map((v) => numberOrNull(v))
    .filter((v) => v !== null);
  if (values.length === 0) return fallback ?? null;
  return Math.min(...values);
}

async function ensureSupplierTables() {
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS supplier_directory (
        id SERIAL PRIMARY KEY,
        supplier_name TEXT NOT NULL UNIQUE,
        main_categories TEXT,
        type TEXT,
        notes_strategy TEXT,
        website TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS supplier_contacts (
        id SERIAL PRIMARY KEY,
        supplier_id INTEGER REFERENCES supplier_directory(id) ON DELETE SET NULL,
        supplier_name TEXT NOT NULL,
        address TEXT,
        phone TEXT,
        fax TEXT,
        email TEXT,
        website TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_supplier_contacts_supplier_name ON supplier_contacts (LOWER(supplier_name))`
    );

    await client.query(`
      CREATE TABLE IF NOT EXISTS supplier_comparison (
        id SERIAL PRIMARY KEY,
        category TEXT,
        brand TEXT,
        menu_section TEXT,
        item TEXT NOT NULL,
        spec_notes TEXT,
        recommended_supplier TEXT,
        alternative_supplier1 TEXT,
        alternative_supplier2 TEXT,
        pack_size TEXT,
        uom TEXT,
        price_supplier1 NUMERIC,
        price_supplier2 NUMERIC,
        price_supplier3 NUMERIC,
        lowest_price NUMERIC,
        chosen_supplier TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_supplier_comparison_lookup
       ON supplier_comparison (LOWER(category), LOWER(brand), LOWER(menu_section), LOWER(item))`
    );

    await client.query(`
      CREATE TABLE IF NOT EXISTS supplier_kitchen_equipment (
        id SERIAL PRIMARY KEY,
        supplier_name TEXT NOT NULL,
        main_category TEXT,
        typical_products TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_supplier_kitchen_equipment_supplier ON supplier_kitchen_equipment (LOWER(supplier_name))`
    );

    await client.query(`
      CREATE TABLE IF NOT EXISTS supplier_packaging_disposables (
        id SERIAL PRIMARY KEY,
        supplier_name TEXT NOT NULL,
        main_category TEXT,
        typical_products TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_supplier_packaging_supplier ON supplier_packaging_disposables (LOWER(supplier_name))`
    );

    await client.query(`
      CREATE TABLE IF NOT EXISTS supplier_hotelware_ose (
        id SERIAL PRIMARY KEY,
        supplier_name TEXT NOT NULL,
        main_category TEXT,
        typical_products TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_supplier_hotelware_supplier ON supplier_hotelware_ose (LOWER(supplier_name))`
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to ensure supplier tables", err);
  } finally {
    client.release();
  }
}

if (pool) {
  ensureSupplierTables().catch((err) =>
    console.error("Supplier table bootstrap failed", err)
  );
}

async function ensureActionPlanTable() {
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS action_plan_3m (
        id SERIAL PRIMARY KEY,
        phase TEXT,
        area TEXT,
        action TEXT,
        description TEXT,
        kpi_metric TEXT,
        kpi_target_m3 TEXT,
        start_month TEXT,
        start_week TEXT,
        end_month TEXT,
        end_week TEXT,
        impact TEXT,
        effort TEXT,
        dependencies TEXT,
        budget_estimate TEXT,
        risk_blockers TEXT,
        validation_method TEXT,
        owner_name TEXT,
        priority TEXT,
        status TEXT,
        comments TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_action_plan_match ON action_plan_3m (LOWER(phase), LOWER(area), LOWER(action), LOWER(owner_name), LOWER(start_month), LOWER(start_week))`
    );
  } catch (err) {
    console.error("Failed to ensure action_plan_3m table", err);
  } finally {
    client.release();
  }
}

if (pool) {
  ensureActionPlanTable().catch((err) =>
    console.error("Action plan table bootstrap failed", err)
  );
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

// Persist rent/opex rows (with optional lease metadata)
app.post("/api/rent-opex", async (req, res) => {
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
    description,
    amount,
    notes,
    isRentFixed,
    frequency,
    landlord,
    leaseStart,
    leaseEnd,
  } = req.body || {};

  if (!date || !brand || !outlet || !category || !description || amount == null) {
    return res.status(400).json({ error: "MISSING_FIELDS" });
  }

  try {
    const columns = ["date", "brand", "outlet", "category", "description", "amount", "notes"];
    const values = [date, brand, outlet, category, description, amount, notes || null];

    if (await hasRentOpexColumn("is_rent_fixed")) {
      columns.push("is_rent_fixed");
      values.push(Boolean(isRentFixed));
    }
    if (await hasRentOpexColumn("frequency")) {
      columns.push("frequency");
      values.push(frequency || null);
    }
    if (await hasRentOpexColumn("landlord")) {
      columns.push("landlord");
      values.push(landlord || null);
    }
    if (await hasRentOpexColumn("lease_start")) {
      columns.push("lease_start");
      values.push(leaseStart || null);
    }
    if (await hasRentOpexColumn("lease_end")) {
      columns.push("lease_end");
      values.push(leaseEnd || null);
    }

    const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(",");
    await pool.query(
      `INSERT INTO rent_opex (${columns.join(",")}) VALUES (${placeholders})`,
      values
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
    const selectCols = [
      "id",
      "date",
      "brand",
      "outlet",
      "category",
      "description",
      "amount",
      "notes",
    ];

    if (await hasRentOpexColumn("is_rent_fixed")) {
      selectCols.push(`is_rent_fixed AS "isRentFixed"`);
    }
    if (await hasRentOpexColumn("frequency")) {
      selectCols.push(`frequency`);
    }
    if (await hasRentOpexColumn("landlord")) {
      selectCols.push(`landlord`);
    }
    if (await hasRentOpexColumn("lease_start")) {
      selectCols.push(`lease_start AS "leaseStart"`);
    }
    if (await hasRentOpexColumn("lease_end")) {
      selectCols.push(`lease_end AS "leaseEnd"`);
    }

    const { rows } = await pool.query(
      `SELECT ${selectCols.join(", ")}
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

// --- Suppliers & Sourcing ---

const makeComparisonKey = (row) =>
  [
    normalizeText(row.category).toLowerCase(),
    normalizeText(row.brand).toLowerCase(),
    normalizeText(row.menuSection).toLowerCase(),
    normalizeText(row.item).toLowerCase(),
  ].join("|");

const makeDirectoryKey = (name) => normalizeText(name).toLowerCase();

const makeContactKey = (row) =>
  [
    makeDirectoryKey(row.supplierName),
    normalizeText(row.phone).toLowerCase(),
    normalizeText(row.email).toLowerCase(),
  ].join("|");

const makeProductKey = (row) =>
  [
    makeDirectoryKey(row.supplierName),
    normalizeText(row.mainCategory).toLowerCase(),
    normalizeText(row.typicalProducts).toLowerCase(),
  ].join("|");

function makeActionPlanKey(row) {
  return [
    normalizeText(row.phase).toLowerCase(),
    normalizeText(row.area).toLowerCase(),
    normalizeText(row.action).toLowerCase(),
    normalizeText(row.owner).toLowerCase(),
    normalizeText(row.startMonth).toLowerCase(),
    normalizeText(row.startWeek).toLowerCase(),
  ].join("|");
}

app.get("/api/suppliers/comparison", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const { category, brand, menuSection, search } = req.query || {};
  const filters = [];
  const params = [];
  let idx = 1;

  if (category) {
    filters.push(`LOWER(COALESCE(category,'')) = LOWER($${idx++})`);
    params.push(category);
  }
  if (brand) {
    filters.push(`LOWER(COALESCE(brand,'')) = LOWER($${idx++})`);
    params.push(brand);
  }
  if (menuSection) {
    filters.push(`LOWER(COALESCE(menu_section,'')) = LOWER($${idx++})`);
    params.push(menuSection);
  }
  if (search) {
    filters.push(`LOWER(item) LIKE $${idx++}`);
    params.push(`%${search.toLowerCase()}%`);
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  try {
    const { rows } = await pool.query(
      `
        SELECT
          id,
          category,
          brand,
          menu_section AS "menuSection",
          item,
          spec_notes AS "specNotes",
          recommended_supplier AS "recommendedSupplier",
          alternative_supplier1 AS "alternativeSupplier1",
          alternative_supplier2 AS "alternativeSupplier2",
          pack_size AS "packSize",
          uom,
          price_supplier1 AS "priceSupplier1",
          price_supplier2 AS "priceSupplier2",
          price_supplier3 AS "priceSupplier3",
          lowest_price AS "lowestPrice",
          chosen_supplier AS "chosenSupplier",
          notes
        FROM supplier_comparison
        ${where}
        ORDER BY category NULLS FIRST, brand NULLS FIRST, item ASC
      `,
      params
    );

    const hydrated = rows.map((r) => ({
      ...r,
      lowestPrice: computeLowestPrice({
        price1: r.priceSupplier1,
        price2: r.priceSupplier2,
        price3: r.priceSupplier3,
        fallback: r.lowestPrice,
      }),
    }));

    res.json({ ok: true, rows: hydrated });
  } catch (err) {
    console.error("Fetch supplier_comparison error:", err);
    res.status(500).json({ error: "FETCH_FAILED", message: err.message });
  }
});

app.post("/api/suppliers/comparison", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const {
    id,
    category,
    brand,
    menuSection,
    item,
    specNotes,
    recommendedSupplier,
    alternativeSupplier1,
    alternativeSupplier2,
    packSize,
    uom,
    priceSupplier1,
    priceSupplier2,
    priceSupplier3,
    lowestPrice,
    chosenSupplier,
    notes,
  } = req.body || {};

  if (!item) {
    return res.status(400).json({ error: "MISSING_FIELDS", message: "Item is required." });
  }

  const computedLowest = computeLowestPrice({
    price1: priceSupplier1,
    price2: priceSupplier2,
    price3: priceSupplier3,
    fallback: lowestPrice,
  });

  const client = await pool.connect();
  try {
    const keyCategory = normalizeText(category);
    const keyBrand = normalizeText(brand);
    const keyMenuSection = normalizeText(menuSection);
    const keyItem = normalizeText(item);

    const upsertParams = [
      keyCategory,
      keyBrand,
      keyMenuSection,
      keyItem,
      specNotes || null,
      recommendedSupplier || null,
      alternativeSupplier1 || null,
      alternativeSupplier2 || null,
      packSize || null,
      uom || null,
      numberOrNull(priceSupplier1),
      numberOrNull(priceSupplier2),
      numberOrNull(priceSupplier3),
      computedLowest,
      chosenSupplier || null,
      notes || null,
    ];

    let targetId = id;
    if (!targetId) {
      const existing = await client.query(
        `
          SELECT id
          FROM supplier_comparison
          WHERE LOWER(COALESCE(category,'')) = LOWER($1)
            AND LOWER(COALESCE(brand,'')) = LOWER($2)
            AND LOWER(COALESCE(menu_section,'')) = LOWER($3)
            AND LOWER(item) = LOWER($4)
          LIMIT 1
        `,
        [keyCategory, keyBrand, keyMenuSection, keyItem]
      );
      if (existing.rows.length) {
        targetId = existing.rows[0].id;
      }
    }

    if (targetId) {
      await client.query(
        `
          UPDATE supplier_comparison
          SET category=$1, brand=$2, menu_section=$3, item=$4,
              spec_notes=$5, recommended_supplier=$6,
              alternative_supplier1=$7, alternative_supplier2=$8,
              pack_size=$9, uom=$10,
              price_supplier1=$11, price_supplier2=$12, price_supplier3=$13,
              lowest_price=$14, chosen_supplier=$15, notes=$16,
              updated_at=NOW()
          WHERE id=$17
        `,
        [...upsertParams, targetId]
      );
      return res.json({ ok: true, id: targetId, lowestPrice: computedLowest });
    }

    const { rows } = await client.query(
      `
        INSERT INTO supplier_comparison (
          category, brand, menu_section, item, spec_notes,
          recommended_supplier, alternative_supplier1, alternative_supplier2,
          pack_size, uom, price_supplier1, price_supplier2, price_supplier3,
          lowest_price, chosen_supplier, notes
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        RETURNING id
      `,
      upsertParams
    );

    res.json({ ok: true, id: rows[0]?.id, lowestPrice: computedLowest });
  } catch (err) {
    console.error("Upsert supplier_comparison error:", err);
    res.status(500).json({ error: "UPSERT_FAILED", message: err.message });
  } finally {
    client.release();
  }
});

app.get("/api/suppliers/directory", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const { type, mainCategory, search } = req.query || {};
  const filters = [];
  const params = [];
  let idx = 1;

  if (type) {
    filters.push(`LOWER(COALESCE(type,'')) = LOWER($${idx++})`);
    params.push(type);
  }
  if (mainCategory) {
    filters.push(`LOWER(COALESCE(main_categories,'')) LIKE $${idx++}`);
    params.push(`%${mainCategory.toLowerCase()}%`);
  }
  if (search) {
    filters.push(
      `(LOWER(supplier_name) LIKE $${idx} OR LOWER(COALESCE(notes_strategy,'')) LIKE $${idx})`
    );
    params.push(`%${search.toLowerCase()}%`);
    idx += 1;
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  try {
    const { rows } = await pool.query(
      `
        SELECT
          id,
          supplier_name AS "supplierName",
          main_categories AS "mainCategories",
          type,
          notes_strategy AS "notesStrategy",
          website
        FROM supplier_directory
        ${where}
        ORDER BY supplier_name ASC
      `,
      params
    );
    res.json({ ok: true, rows });
  } catch (err) {
    console.error("Fetch supplier_directory error:", err);
    res.status(500).json({ error: "FETCH_FAILED", message: err.message });
  }
});

app.post("/api/suppliers/directory", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const { id, supplierName, mainCategories, type, notesStrategy, website } = req.body || {};
  if (!supplierName) {
    return res.status(400).json({ error: "MISSING_FIELDS", message: "Supplier name is required." });
  }

  const nameKey = makeDirectoryKey(supplierName);
  const client = await pool.connect();

  try {
    let targetId = id;
    if (!targetId) {
      const existing = await client.query(
        `SELECT id FROM supplier_directory WHERE LOWER(supplier_name) = $1 LIMIT 1`,
        [nameKey]
      );
      if (existing.rows.length) {
        targetId = existing.rows[0].id;
      }
    }

    if (targetId) {
      await client.query(
        `
          UPDATE supplier_directory
          SET supplier_name=$1, main_categories=$2, type=$3,
              notes_strategy=$4, website=$5, updated_at=NOW()
          WHERE id=$6
        `,
        [supplierName, mainCategories || null, type || null, notesStrategy || null, website || null, targetId]
      );
      return res.json({ ok: true, id: targetId });
    }

    const { rows } = await client.query(
      `
        INSERT INTO supplier_directory (supplier_name, main_categories, type, notes_strategy, website)
        VALUES ($1,$2,$3,$4,$5)
        RETURNING id
      `,
      [supplierName, mainCategories || null, type || null, notesStrategy || null, website || null]
    );
    res.json({ ok: true, id: rows[0]?.id });
  } catch (err) {
    console.error("Upsert supplier_directory error:", err);
    res.status(500).json({ error: "UPSERT_FAILED", message: err.message });
  } finally {
    client.release();
  }
});

app.get("/api/suppliers/contacts", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const { supplierName, search } = req.query || {};
  const filters = [];
  const params = [];
  let idx = 1;

  if (supplierName) {
    filters.push(`LOWER(c.supplier_name) = LOWER($${idx++})`);
    params.push(supplierName);
  }

  if (search) {
    filters.push(
      `(LOWER(c.supplier_name) LIKE $${idx} OR LOWER(COALESCE(c.address,'')) LIKE $${idx} OR LOWER(COALESCE(c.notes,'')) LIKE $${idx})`
    );
    params.push(`%${search.toLowerCase()}%`);
    idx += 1;
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")} ` : "";

  try {
    const { rows } = await pool.query(
      `
        SELECT
          c.id,
          c.supplier_id AS "supplierId",
          c.supplier_name AS "supplierName",
          c.address,
          c.phone,
          c.fax,
          c.email,
          c.website,
          c.notes,
          d.main_categories AS "directoryCategories",
          d.type AS "directoryType"
        FROM supplier_contacts c
        LEFT JOIN supplier_directory d ON d.id = c.supplier_id
        ${where}
        ORDER BY c.supplier_name ASC, c.id DESC
      `,
      params
    );
    res.json({ ok: true, rows });
  } catch (err) {
    console.error("Fetch supplier_contacts error:", err);
    res.status(500).json({ error: "FETCH_FAILED", message: err.message });
  }
});

app.post("/api/suppliers/contacts", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const { id, supplierName, address, phone, fax, email, website, notes } = req.body || {};
  if (!supplierName) {
    return res.status(400).json({ error: "MISSING_FIELDS", message: "Supplier name is required." });
  }

  const nameKey = makeDirectoryKey(supplierName);
  const client = await pool.connect();

  try {
    const directoryLookup = await client.query(
      `SELECT id FROM supplier_directory WHERE LOWER(supplier_name) = $1 LIMIT 1`,
      [nameKey]
    );
    const supplierId = directoryLookup.rows[0]?.id || null;

    if (id) {
      await client.query(
        `
          UPDATE supplier_contacts
          SET supplier_id=$1, supplier_name=$2, address=$3, phone=$4, fax=$5, email=$6, website=$7, notes=$8, updated_at=NOW()
          WHERE id=$9
        `,
        [supplierId, supplierName, address || null, phone || null, fax || null, email || null, website || null, notes || null, id]
      );
      return res.json({ ok: true, id });
    }

    const { rows } = await client.query(
      `
        INSERT INTO supplier_contacts (supplier_id, supplier_name, address, phone, fax, email, website, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING id
      `,
      [supplierId, supplierName, address || null, phone || null, fax || null, email || null, website || null, notes || null]
    );
    res.json({ ok: true, id: rows[0]?.id });
  } catch (err) {
    console.error("Upsert supplier_contacts error:", err);
    res.status(500).json({ error: "UPSERT_FAILED", message: err.message });
  } finally {
    client.release();
  }
});

app.get("/api/suppliers/kitchen-equipment", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const { mainCategory, search } = req.query || {};
  const filters = [];
  const params = [];
  let idx = 1;

  if (mainCategory) {
    filters.push(`LOWER(COALESCE(main_category,'')) = LOWER($${idx++})`);
    params.push(mainCategory);
  }
  if (search) {
    filters.push(
      `(LOWER(supplier_name) LIKE $${idx} OR LOWER(COALESCE(typical_products,'')) LIKE $${idx})`
    );
    params.push(`%${search.toLowerCase()}%`);
    idx += 1;
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  try {
    const { rows } = await pool.query(
      `
        SELECT
          id,
          supplier_name AS "supplierName",
          main_category AS "mainCategory",
          typical_products AS "typicalProducts",
          notes
        FROM supplier_kitchen_equipment
        ${where}
        ORDER BY supplier_name ASC
      `,
      params
    );
    res.json({ ok: true, rows });
  } catch (err) {
    console.error("Fetch supplier_kitchen_equipment error:", err);
    res.status(500).json({ error: "FETCH_FAILED", message: err.message });
  }
});

app.post("/api/suppliers/kitchen-equipment", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const { id, supplierName, mainCategory, typicalProducts, notes } = req.body || {};
  if (!supplierName) {
    return res.status(400).json({ error: "MISSING_FIELDS", message: "Supplier name is required." });
  }

  const client = await pool.connect();
  try {
    if (id) {
      await client.query(
        `
          UPDATE supplier_kitchen_equipment
          SET supplier_name=$1, main_category=$2, typical_products=$3, notes=$4, updated_at=NOW()
          WHERE id=$5
        `,
        [supplierName, mainCategory || null, typicalProducts || null, notes || null, id]
      );
      return res.json({ ok: true, id });
    }

    const existing = await client.query(
      `
        SELECT id
        FROM supplier_kitchen_equipment
        WHERE LOWER(supplier_name)=LOWER($1)
          AND LOWER(COALESCE(main_category,'')) = LOWER($2)
          AND LOWER(COALESCE(typical_products,'')) = LOWER($3)
        LIMIT 1
      `,
      [supplierName, mainCategory || "", typicalProducts || ""]
    );

    if (existing.rows.length) {
      const existingId = existing.rows[0].id;
      await client.query(
        `
          UPDATE supplier_kitchen_equipment
          SET supplier_name=$1, main_category=$2, typical_products=$3, notes=$4, updated_at=NOW()
          WHERE id=$5
        `,
        [supplierName, mainCategory || null, typicalProducts || null, notes || null, existingId]
      );
      return res.json({ ok: true, id: existingId });
    }

    const { rows } = await client.query(
      `
        INSERT INTO supplier_kitchen_equipment (supplier_name, main_category, typical_products, notes)
        VALUES ($1,$2,$3,$4)
        RETURNING id
      `,
      [supplierName, mainCategory || null, typicalProducts || null, notes || null]
    );
    res.json({ ok: true, id: rows[0]?.id });
  } catch (err) {
    console.error("Upsert supplier_kitchen_equipment error:", err);
    res.status(500).json({ error: "UPSERT_FAILED", message: err.message });
  } finally {
    client.release();
  }
});

app.get("/api/suppliers/packaging-disposables", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const { mainCategory, search } = req.query || {};
  const filters = [];
  const params = [];
  let idx = 1;

  if (mainCategory) {
    filters.push(`LOWER(COALESCE(main_category,'')) = LOWER($${idx++})`);
    params.push(mainCategory);
  }
  if (search) {
    filters.push(
      `(LOWER(supplier_name) LIKE $${idx} OR LOWER(COALESCE(typical_products,'')) LIKE $${idx})`
    );
    params.push(`%${search.toLowerCase()}%`);
    idx += 1;
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  try {
    const { rows } = await pool.query(
      `
        SELECT
          id,
          supplier_name AS "supplierName",
          main_category AS "mainCategory",
          typical_products AS "typicalProducts",
          notes
        FROM supplier_packaging_disposables
        ${where}
        ORDER BY supplier_name ASC
      `,
      params
    );
    res.json({ ok: true, rows });
  } catch (err) {
    console.error("Fetch supplier_packaging_disposables error:", err);
    res.status(500).json({ error: "FETCH_FAILED", message: err.message });
  }
});

app.post("/api/suppliers/packaging-disposables", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const { id, supplierName, mainCategory, typicalProducts, notes } = req.body || {};
  if (!supplierName) {
    return res.status(400).json({ error: "MISSING_FIELDS", message: "Supplier name is required." });
  }

  const client = await pool.connect();
  try {
    if (id) {
      await client.query(
        `
          UPDATE supplier_packaging_disposables
          SET supplier_name=$1, main_category=$2, typical_products=$3, notes=$4, updated_at=NOW()
          WHERE id=$5
        `,
        [supplierName, mainCategory || null, typicalProducts || null, notes || null, id]
      );
      return res.json({ ok: true, id });
    }

    const existing = await client.query(
      `
        SELECT id
        FROM supplier_packaging_disposables
        WHERE LOWER(supplier_name)=LOWER($1)
          AND LOWER(COALESCE(main_category,'')) = LOWER($2)
          AND LOWER(COALESCE(typical_products,'')) = LOWER($3)
        LIMIT 1
      `,
      [supplierName, mainCategory || "", typicalProducts || ""]
    );

    if (existing.rows.length) {
      const existingId = existing.rows[0].id;
      await client.query(
        `
          UPDATE supplier_packaging_disposables
          SET supplier_name=$1, main_category=$2, typical_products=$3, notes=$4, updated_at=NOW()
          WHERE id=$5
        `,
        [supplierName, mainCategory || null, typicalProducts || null, notes || null, existingId]
      );
      return res.json({ ok: true, id: existingId });
    }

    const { rows } = await client.query(
      `
        INSERT INTO supplier_packaging_disposables (supplier_name, main_category, typical_products, notes)
        VALUES ($1,$2,$3,$4)
        RETURNING id
      `,
      [supplierName, mainCategory || null, typicalProducts || null, notes || null]
    );
    res.json({ ok: true, id: rows[0]?.id });
  } catch (err) {
    console.error("Upsert supplier_packaging_disposables error:", err);
    res.status(500).json({ error: "UPSERT_FAILED", message: err.message });
  } finally {
    client.release();
  }
});

app.get("/api/suppliers/hotelware-ose", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const { mainCategory, search } = req.query || {};
  const filters = [];
  const params = [];
  let idx = 1;

  if (mainCategory) {
    filters.push(`LOWER(COALESCE(main_category,'')) = LOWER($${idx++})`);
    params.push(mainCategory);
  }
  if (search) {
    filters.push(
      `(LOWER(supplier_name) LIKE $${idx} OR LOWER(COALESCE(typical_products,'')) LIKE $${idx})`
    );
    params.push(`%${search.toLowerCase()}%`);
    idx += 1;
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  try {
    const { rows } = await pool.query(
      `
        SELECT
          id,
          supplier_name AS "supplierName",
          main_category AS "mainCategory",
          typical_products AS "typicalProducts",
          notes
        FROM supplier_hotelware_ose
        ${where}
        ORDER BY supplier_name ASC
      `,
      params
    );
    res.json({ ok: true, rows });
  } catch (err) {
    console.error("Fetch supplier_hotelware_ose error:", err);
    res.status(500).json({ error: "FETCH_FAILED", message: err.message });
  }
});

app.post("/api/suppliers/hotelware-ose", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const { id, supplierName, mainCategory, typicalProducts, notes } = req.body || {};
  if (!supplierName) {
    return res.status(400).json({ error: "MISSING_FIELDS", message: "Supplier name is required." });
  }

  const client = await pool.connect();
  try {
    if (id) {
      await client.query(
        `
          UPDATE supplier_hotelware_ose
          SET supplier_name=$1, main_category=$2, typical_products=$3, notes=$4, updated_at=NOW()
          WHERE id=$5
        `,
        [supplierName, mainCategory || null, typicalProducts || null, notes || null, id]
      );
      return res.json({ ok: true, id });
    }

    const existing = await client.query(
      `
        SELECT id
        FROM supplier_hotelware_ose
        WHERE LOWER(supplier_name)=LOWER($1)
          AND LOWER(COALESCE(main_category,'')) = LOWER($2)
          AND LOWER(COALESCE(typical_products,'')) = LOWER($3)
        LIMIT 1
      `,
      [supplierName, mainCategory || "", typicalProducts || ""]
    );

    if (existing.rows.length) {
      const existingId = existing.rows[0].id;
      await client.query(
        `
          UPDATE supplier_hotelware_ose
          SET supplier_name=$1, main_category=$2, typical_products=$3, notes=$4, updated_at=NOW()
          WHERE id=$5
        `,
        [supplierName, mainCategory || null, typicalProducts || null, notes || null, existingId]
      );
      return res.json({ ok: true, id: existingId });
    }

    const { rows } = await client.query(
      `
        INSERT INTO supplier_hotelware_ose (supplier_name, main_category, typical_products, notes)
        VALUES ($1,$2,$3,$4)
        RETURNING id
      `,
      [supplierName, mainCategory || null, typicalProducts || null, notes || null]
    );
    res.json({ ok: true, id: rows[0]?.id });
  } catch (err) {
    console.error("Upsert supplier_hotelware_ose error:", err);
    res.status(500).json({ error: "UPSERT_FAILED", message: err.message });
  } finally {
    client.release();
  }
});

// Lightweight service to expose chosen supplier & cost for recipes/KPIs
app.get("/api/suppliers/cost", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const { category, brand, item } = req.query || {};
  if (!category || !item) {
    return res.status(400).json({ error: "MISSING_FIELDS", message: "Category and item are required." });
  }

  const filters = [`LOWER(COALESCE(category,'')) = LOWER($1)`, `LOWER(item) = LOWER($2)`];
  const params = [category, item];
  let idx = 3;
  if (brand) {
    filters.push(`LOWER(COALESCE(brand,'')) = LOWER($${idx++})`);
    params.push(brand);
  }

  const where = `WHERE ${filters.join(" AND ")}`;

  try {
    const { rows } = await pool.query(
      `
        SELECT
          id,
          category,
          brand,
          menu_section AS "menuSection",
          item,
          recommended_supplier AS "recommendedSupplier",
          chosen_supplier AS "chosenSupplier",
          price_supplier1 AS "priceSupplier1",
          price_supplier2 AS "priceSupplier2",
          price_supplier3 AS "priceSupplier3",
          lowest_price AS "lowestPrice"
        FROM supplier_comparison
        ${where}
        ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
        LIMIT 1
      `,
      params
    );

    if (!rows.length) {
      return res.json({ ok: true, record: null });
    }

    const row = rows[0];
    const lowest = computeLowestPrice({
      price1: row.priceSupplier1,
      price2: row.priceSupplier2,
      price3: row.priceSupplier3,
      fallback: row.lowestPrice,
    });

    res.json({
      ok: true,
      record: {
        ...row,
        lowestPrice: lowest,
        costPerUnit: lowest,
        supplier: row.chosenSupplier || row.recommendedSupplier || null,
      },
    });
  } catch (err) {
    console.error("Fetch supplier cost error:", err);
    res.status(500).json({ error: "FETCH_FAILED", message: err.message });
  }
});

// Workbook import (supports dry-run preview)
app.post("/api/suppliers/comparison/import", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const { fileBase64, fileName, dryRun = true } = req.body || {};
  if (!fileBase64) {
    return res.status(400).json({ error: "MISSING_FILE", message: "fileBase64 is required." });
  }

  try {
    const buffer = Buffer.from(fileBase64, "base64");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);

    const errors = [];
    const summary = {};

    const parseSheet = (sheetName, requiredHeaders, mapper) => {
      const sheet = wb.getWorksheet(sheetName);
      if (!sheet) {
        summary[sheetName] = { found: false, rows: 0, inserts: 0, updates: 0 };
        return [];
      }

      const headerMap = {};
      sheet.getRow(1).eachCell((cell, colNumber) => {
        const key = normalizeText(cell.value);
        if (key) headerMap[key] = colNumber;
      });

      const missing = requiredHeaders.filter((h) => !headerMap[h]);
      if (missing.length) {
        errors.push(`Sheet "${sheetName}" is missing columns: ${missing.join(", ")}`);
        summary[sheetName] = { found: true, rows: 0, inserts: 0, updates: 0, missing };
        return [];
      }

      const rows = [];
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const getCell = (header) => {
          const col = headerMap[header];
          if (!col) return "";
          const val = row.getCell(col).value;
          if (val && typeof val === "object" && val.text) return val.text;
          if (val && typeof val === "object" && val.result !== undefined) return val.result;
          return val ?? "";
        };
        const mapped = mapper(getCell);
        const hasData = Object.values(mapped).some((v) => normalizeText(v) !== "" || typeof v === "number");
        if (hasData) rows.push(mapped);
      });

      summary[sheetName] = { found: true, rows: rows.length, inserts: 0, updates: 0 };
      return rows;
    };

    const comparisonRows = parseSheet(
      "Supplier_Comparison",
      [
        "Category",
        "Brand",
        "Menu Section",
        "Item",
        "Spec / Notes",
        "Recommended Supplier (Cost-efficient)",
        "Alternative Supplier 1",
        "Alternative Supplier 2",
        "Pack Size",
        "UOM",
        "Price - Supplier 1 (JOD)",
        "Price - Supplier 2 (JOD)",
        "Price - Supplier 3 (JOD)",
        "Lowest Price (JOD)",
        "Chosen Supplier",
        "Notes",
      ],
      (get) => ({
        category: normalizeText(get("Category")),
        brand: normalizeText(get("Brand")),
        menuSection: normalizeText(get("Menu Section")),
        item: normalizeText(get("Item")),
        specNotes: normalizeText(get("Spec / Notes")),
        recommendedSupplier: normalizeText(get("Recommended Supplier (Cost-efficient)")),
        alternativeSupplier1: normalizeText(get("Alternative Supplier 1")),
        alternativeSupplier2: normalizeText(get("Alternative Supplier 2")),
        packSize: normalizeText(get("Pack Size")),
        uom: normalizeText(get("UOM")),
        priceSupplier1: numberOrNull(get("Price - Supplier 1 (JOD)")),
        priceSupplier2: numberOrNull(get("Price - Supplier 2 (JOD)")),
        priceSupplier3: numberOrNull(get("Price - Supplier 3 (JOD)")),
        lowestPrice: numberOrNull(get("Lowest Price (JOD)")),
        chosenSupplier: normalizeText(get("Chosen Supplier")),
        notes: normalizeText(get("Notes")),
      })
    );

    const directoryRows = parseSheet(
      "Supplier_Directory",
      ["Supplier Name", "Main Categories", "Type", "Notes / Strategy", "Website"],
      (get) => ({
        supplierName: normalizeText(get("Supplier Name")),
        mainCategories: normalizeText(get("Main Categories")),
        type: normalizeText(get("Type")),
        notesStrategy: normalizeText(get("Notes / Strategy")),
        website: normalizeText(get("Website")),
      })
    );

    const contactRows = parseSheet(
      "Supplier_Contacts",
      ["Supplier Name", "Address", "Phone", "Fax", "Email", "Website", "Notes"],
      (get) => ({
        supplierName: normalizeText(get("Supplier Name")),
        address: normalizeText(get("Address")),
        phone: normalizeText(get("Phone")),
        fax: normalizeText(get("Fax")),
        email: normalizeText(get("Email")),
        website: normalizeText(get("Website")),
        notes: normalizeText(get("Notes")),
      })
    );

    const kitchenRows = parseSheet(
      "Kitchen_Equipment",
      ["Supplier Name", "Main Category", "Typical Products / Focus", "Notes"],
      (get) => ({
        supplierName: normalizeText(get("Supplier Name")),
        mainCategory: normalizeText(get("Main Category")),
        typicalProducts: normalizeText(get("Typical Products / Focus")),
        notes: normalizeText(get("Notes")),
      })
    );

    const packagingRows = parseSheet(
      "Packaging_Disposables",
      ["Supplier Name", "Main Category", "Typical Products / Focus", "Notes"],
      (get) => ({
        supplierName: normalizeText(get("Supplier Name")),
        mainCategory: normalizeText(get("Main Category")),
        typicalProducts: normalizeText(get("Typical Products / Focus")),
        notes: normalizeText(get("Notes")),
      })
    );

    const hotelwareRows = parseSheet(
      "Hotelware_OSE",
      ["Supplier Name", "Main Category", "Typical Products / Focus", "Notes"],
      (get) => ({
        supplierName: normalizeText(get("Supplier Name")),
        mainCategory: normalizeText(get("Main Category")),
        typicalProducts: normalizeText(get("Typical Products / Focus")),
        notes: normalizeText(get("Notes")),
      })
    );

    if (errors.length) {
      return res.status(400).json({ error: "INVALID_WORKBOOK", errors, summary });
    }

    const client = await pool.connect();
    try {
      if (!dryRun) {
        await client.query("BEGIN");
      }

      const comparisonExisting = await client.query(
        `SELECT id, category, brand, menu_section, item FROM supplier_comparison`
      );
      const comparisonMap = new Map();
      comparisonExisting.rows.forEach((r) => {
        comparisonMap.set(
          makeComparisonKey({
            category: r.category,
            brand: r.brand,
            menuSection: r.menu_section,
            item: r.item,
          }),
          r
        );
      });

      const directoryExisting = await client.query(`SELECT id, supplier_name FROM supplier_directory`);
      const directoryMap = new Map();
      directoryExisting.rows.forEach((r) => directoryMap.set(makeDirectoryKey(r.supplier_name), r.id));

      const contactExisting = await client.query(
        `SELECT id, supplier_name, phone, email FROM supplier_contacts`
      );
      const contactMap = new Map();
      contactExisting.rows.forEach((r) =>
        contactMap.set(
          makeContactKey({ supplierName: r.supplier_name, phone: r.phone, email: r.email }),
          r.id
        )
      );

      const kitchenExisting = await client.query(
        `SELECT id, supplier_name, main_category, typical_products FROM supplier_kitchen_equipment`
      );
      const kitchenMap = new Map();
      kitchenExisting.rows.forEach((r) =>
        kitchenMap.set(
          makeProductKey({
            supplierName: r.supplier_name,
            mainCategory: r.main_category,
            typicalProducts: r.typical_products,
          }),
          r.id
        )
      );

      const packagingExisting = await client.query(
        `SELECT id, supplier_name, main_category, typical_products FROM supplier_packaging_disposables`
      );
      const packagingMap = new Map();
      packagingExisting.rows.forEach((r) =>
        packagingMap.set(
          makeProductKey({
            supplierName: r.supplier_name,
            mainCategory: r.main_category,
            typicalProducts: r.typical_products,
          }),
          r.id
        )
      );

      const hotelExisting = await client.query(
        `SELECT id, supplier_name, main_category, typical_products FROM supplier_hotelware_ose`
      );
      const hotelMap = new Map();
      hotelExisting.rows.forEach((r) =>
        hotelMap.set(
          makeProductKey({
            supplierName: r.supplier_name,
            mainCategory: r.main_category,
            typicalProducts: r.typical_products,
          }),
          r.id
        )
      );

      // Upsert Supplier Directory first (needed for foreign keys)
      for (const row of directoryRows) {
        if (!row.supplierName) continue;
        const key = makeDirectoryKey(row.supplierName);
        const existingId = directoryMap.get(key);
        if (existingId) {
          summary["Supplier_Directory"].updates += 1;
          if (!dryRun) {
            await client.query(
              `
                UPDATE supplier_directory
                SET supplier_name=$1, main_categories=$2, type=$3, notes_strategy=$4, website=$5, updated_at=NOW()
                WHERE id=$6
              `,
              [row.supplierName, row.mainCategories || null, row.type || null, row.notesStrategy || null, row.website || null, existingId]
            );
          }
        } else {
          summary["Supplier_Directory"].inserts += 1;
          if (!dryRun) {
            const { rows } = await client.query(
              `
                INSERT INTO supplier_directory (supplier_name, main_categories, type, notes_strategy, website)
                VALUES ($1,$2,$3,$4,$5)
                RETURNING id
              `,
              [row.supplierName, row.mainCategories || null, row.type || null, row.notesStrategy || null, row.website || null]
            );
            directoryMap.set(key, rows[0]?.id);
          }
        }
      }

      for (const row of comparisonRows) {
        if (!row.item) continue;
        const key = makeComparisonKey(row);
        const lowest = computeLowestPrice({
          price1: row.priceSupplier1,
          price2: row.priceSupplier2,
          price3: row.priceSupplier3,
          fallback: row.lowestPrice,
        });
        const payload = [
          row.category || "",
          row.brand || "",
          row.menuSection || "",
          row.item,
          row.specNotes || null,
          row.recommendedSupplier || null,
          row.alternativeSupplier1 || null,
          row.alternativeSupplier2 || null,
          row.packSize || null,
          row.uom || null,
          numberOrNull(row.priceSupplier1),
          numberOrNull(row.priceSupplier2),
          numberOrNull(row.priceSupplier3),
          lowest,
          row.chosenSupplier || null,
          row.notes || null,
        ];

        const existing = comparisonMap.get(key);
        if (existing) {
          summary["Supplier_Comparison"].updates += 1;
          if (!dryRun) {
            await client.query(
              `
                UPDATE supplier_comparison
                SET category=$1, brand=$2, menu_section=$3, item=$4,
                    spec_notes=$5, recommended_supplier=$6, alternative_supplier1=$7, alternative_supplier2=$8,
                    pack_size=$9, uom=$10, price_supplier1=$11, price_supplier2=$12, price_supplier3=$13,
                    lowest_price=$14, chosen_supplier=$15, notes=$16, updated_at=NOW()
                WHERE id=$17
              `,
              [...payload, existing.id]
            );
          }
        } else {
          summary["Supplier_Comparison"].inserts += 1;
          if (!dryRun) {
            const { rows } = await client.query(
              `
                INSERT INTO supplier_comparison (
                  category, brand, menu_section, item, spec_notes,
                  recommended_supplier, alternative_supplier1, alternative_supplier2,
                  pack_size, uom, price_supplier1, price_supplier2, price_supplier3,
                  lowest_price, chosen_supplier, notes
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
                RETURNING id
              `,
              payload
            );
            comparisonMap.set(key, { id: rows[0]?.id });
          }
        }
      }

      for (const row of contactRows) {
        if (!row.supplierName) continue;
        const key = makeContactKey(row);
        const supplierId = directoryMap.get(makeDirectoryKey(row.supplierName)) || null;
        const existingId = contactMap.get(key);
        if (existingId) {
          summary["Supplier_Contacts"].updates += 1;
          if (!dryRun) {
            await client.query(
              `
                UPDATE supplier_contacts
                SET supplier_id=$1, supplier_name=$2, address=$3, phone=$4, fax=$5, email=$6, website=$7, notes=$8, updated_at=NOW()
                WHERE id=$9
              `,
              [
                supplierId,
                row.supplierName,
                row.address || null,
                row.phone || null,
                row.fax || null,
                row.email || null,
                row.website || null,
                row.notes || null,
                existingId,
              ]
            );
          }
        } else {
          summary["Supplier_Contacts"].inserts += 1;
          if (!dryRun) {
            const { rows } = await client.query(
              `
                INSERT INTO supplier_contacts (supplier_id, supplier_name, address, phone, fax, email, website, notes)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                RETURNING id
              `,
              [
                supplierId,
                row.supplierName,
                row.address || null,
                row.phone || null,
                row.fax || null,
                row.email || null,
                row.website || null,
                row.notes || null,
              ]
            );
            contactMap.set(key, rows[0]?.id);
          }
        }
      }

      const upsertGeneric = async (rowsArr, map, summaryKey, tableName) => {
        for (const row of rowsArr) {
          if (!row.supplierName) continue;
          const key = makeProductKey(row);
          const existingId = map.get(key);
          if (existingId) {
            summary[summaryKey].updates += 1;
            if (!dryRun) {
              await client.query(
                `
                  UPDATE ${tableName}
                  SET supplier_name=$1, main_category=$2, typical_products=$3, notes=$4, updated_at=NOW()
                  WHERE id=$5
                `,
                [row.supplierName, row.mainCategory || null, row.typicalProducts || null, row.notes || null, existingId]
              );
            }
          } else {
            summary[summaryKey].inserts += 1;
            if (!dryRun) {
              const { rows } = await client.query(
                `
                  INSERT INTO ${tableName} (supplier_name, main_category, typical_products, notes)
                  VALUES ($1,$2,$3,$4)
                  RETURNING id
                `,
                [row.supplierName, row.mainCategory || null, row.typicalProducts || null, row.notes || null]
              );
              map.set(key, rows[0]?.id);
            }
          }
        }
      };

      await upsertGeneric(kitchenRows, kitchenMap, "Kitchen_Equipment", "supplier_kitchen_equipment");
      await upsertGeneric(packagingRows, packagingMap, "Packaging_Disposables", "supplier_packaging_disposables");
      await upsertGeneric(hotelwareRows, hotelMap, "Hotelware_OSE", "supplier_hotelware_ose");

      if (!dryRun) {
        await client.query("COMMIT");
      }

      res.json({
        ok: true,
        dryRun: !!dryRun,
        summary,
        fileName: fileName || null,
      });
    } catch (err) {
      if (!dryRun) {
        await client.query("ROLLBACK");
      }
      console.error("Supplier workbook import failed:", err);
      res.status(500).json({ error: "IMPORT_FAILED", message: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Import parsing error:", err);
    res.status(500).json({ error: "IMPORT_PARSE_FAILED", message: err.message });
  }
});

// --- Action Plan 3M ---

function mapActionPlanRow(row) {
  return {
    phase: normalizeText(row.phase),
    area: normalizeText(row.area),
    action: normalizeText(row.action),
    description: normalizeText(row.description),
    kpiMetric: normalizeText(row.kpiMetric),
    kpiTargetM3: normalizeText(row.kpiTargetM3),
    startMonth: normalizeText(row.startMonth),
    startWeek: normalizeText(row.startWeek),
    endMonth: normalizeText(row.endMonth),
    endWeek: normalizeText(row.endWeek),
    impact: normalizeText(row.impact),
    effort: normalizeText(row.effort),
    dependencies: normalizeText(row.dependencies),
    budgetEstimate: normalizeText(row.budgetEstimate),
    riskBlockers: normalizeText(row.riskBlockers),
    validationMethod: normalizeText(row.validationMethod),
    owner: normalizeText(row.owner),
    priority: normalizeText(row.priority),
    status: normalizeText(row.status),
    comments: normalizeText(row.comments),
  };
}

app.get("/api/action-plan", async (_req, res) => {
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
          phase,
          area,
          action,
          description,
          kpi_metric AS "kpiMetric",
          kpi_target_m3 AS "kpiTargetM3",
          start_month AS "startMonth",
          start_week AS "startWeek",
          end_month AS "endMonth",
          end_week AS "endWeek",
          impact,
          effort,
          dependencies,
          budget_estimate AS "budgetEstimate",
          risk_blockers AS "riskBlockers",
          validation_method AS "validationMethod",
          owner_name AS "owner",
          priority,
          status,
          comments,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM action_plan_3m
        ORDER BY created_at DESC NULLS LAST
      `
    );
    res.json({ ok: true, rows });
  } catch (err) {
    console.error("Fetch action_plan_3m error:", err);
    res.status(500).json({ error: "FETCH_FAILED", message: err.message });
  }
});

app.post("/api/action-plan", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }
  const row = mapActionPlanRow(req.body || {});
  if (!row.phase || !row.area || !row.action || !row.owner || !row.startMonth || !row.startWeek || !row.status) {
    return res.status(400).json({ error: "MISSING_FIELDS" });
  }
  try {
    const { rows: inserted } = await pool.query(
      `
        INSERT INTO action_plan_3m (
          phase, area, action, description, kpi_metric, kpi_target_m3,
          start_month, start_week, end_month, end_week, impact, effort,
          dependencies, budget_estimate, risk_blockers, validation_method,
          owner_name, priority, status, comments
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
        )
        RETURNING id
      `,
      [
        row.phase,
        row.area,
        row.action,
        row.description || null,
        row.kpiMetric || null,
        row.kpiTargetM3 || null,
        row.startMonth,
        row.startWeek,
        row.endMonth || null,
        row.endWeek || null,
        row.impact || null,
        row.effort || null,
        row.dependencies || null,
        row.budgetEstimate || null,
        row.riskBlockers || null,
        row.validationMethod || null,
        row.owner,
        row.priority || null,
        row.status,
        row.comments || null,
      ]
    );
    res.json({ ok: true, id: inserted[0]?.id });
  } catch (err) {
    console.error("Insert action_plan_3m error:", err);
    res.status(500).json({ error: "INSERT_FAILED", message: err.message });
  }
});

app.patch("/api/action-plan/:id", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }
  const { id } = req.params;
  const row = mapActionPlanRow(req.body || {});
  try {
    await pool.query(
      `
        UPDATE action_plan_3m
        SET phase=$1, area=$2, action=$3, description=$4, kpi_metric=$5, kpi_target_m3=$6,
            start_month=$7, start_week=$8, end_month=$9, end_week=$10, impact=$11, effort=$12,
            dependencies=$13, budget_estimate=$14, risk_blockers=$15, validation_method=$16,
            owner_name=$17, priority=$18, status=$19, comments=$20, updated_at=NOW()
        WHERE id=$21
      `,
      [
        row.phase || null,
        row.area || null,
        row.action || null,
        row.description || null,
        row.kpiMetric || null,
        row.kpiTargetM3 || null,
        row.startMonth || null,
        row.startWeek || null,
        row.endMonth || null,
        row.endWeek || null,
        row.impact || null,
        row.effort || null,
        row.dependencies || null,
        row.budgetEstimate || null,
        row.riskBlockers || null,
        row.validationMethod || null,
        row.owner || null,
        row.priority || null,
        row.status || null,
        row.comments || null,
        id,
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("Update action_plan_3m error:", err);
    res.status(500).json({ error: "UPDATE_FAILED", message: err.message });
  }
});

app.post("/api/action-plan/import-excel", async (req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }

  const { fileBase64, fileName, previewOnly = false } = req.body || {};
  if (!fileBase64) {
    return res.status(400).json({ error: "MISSING_FILE", message: "fileBase64 is required" });
  }

  try {
    const buffer = Buffer.from(fileBase64, "base64");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const sheet = wb.getWorksheet("Sheet1");
    if (!sheet) {
      return res.status(400).json({ error: "MISSING_SHEET", message: "Sheet1 not found" });
    }

    const headers = [
      "Phase",
      "Area",
      "Action",
      "Description",
      "KPI Metric",
      "KPI Target by Month 3",
      "Start Month",
      "Start Week",
      "End Month",
      "End Week",
      "Impact (H/M/L)",
      "Effort / Complexity (H/M/L)",
      "Dependencies",
      "Budget / Cost Estimate",
      "Risk / Blockers",
      "Validation Method",
      "Owner",
      "Priority",
      "Status",
      "Comments",
    ];

    const normalizeHeaderKey = (val) =>
      normalizeText(val)
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

    // Find best header row by matching expected headers
    let headerRowIdx = 0;
    let bestMatch = -1;
    let headerMap = {};

    sheet.eachRow((row) => {
      const mapCandidate = {};
      let matches = 0;
      row.eachCell((cell, col) => {
        const raw = cell?.value;
        let key = "";
        if (raw && typeof raw === "object") {
          if (raw.text) key = raw.text;
          else if (raw.result !== undefined) key = raw.result;
          else if (Array.isArray(raw.richText)) key = raw.richText.map((t) => t.text || "").join("");
        } else {
          key = raw;
        }
        key = normalizeHeaderKey(key);
        if (key) {
          mapCandidate[key] = col;
          if (headers.some((h) => normalizeHeaderKey(h) === key)) {
            matches += 1;
          }
        }
      });
      if (matches > bestMatch) {
        bestMatch = matches;
        headerRowIdx = row.number;
        headerMap = mapCandidate;
      }
    });

    const headerSet = new Set(Object.keys(headerMap));
    const missing = headers.filter((h) => !headerSet.has(normalizeHeaderKey(h)));
    if (missing.length) {
      return res
        .status(400)
        .json({ error: "INVALID_HEADERS", message: `Missing columns: ${missing.join(", ")}` });
    }

    const rows = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRowIdx) return; // skip description/header rows
      const get = (header) => {
        const col = headerMap[normalizeHeaderKey(header)];
        if (!col) return "";
        const val = row.getCell(col).value;
        if (val && typeof val === "object" && val.text) return val.text;
        if (val && typeof val === "object" && val.result !== undefined) return val.result;
        if (val && typeof val === "object" && Array.isArray(val.richText)) {
          return val.richText.map((t) => t.text || "").join("");
        }
        return val ?? "";
      };

      const mapped = {
        phase: get("Phase"),
        area: get("Area"),
        action: get("Action"),
        description: get("Description"),
        kpiMetric: get("KPI Metric"),
        kpiTargetM3: get("KPI Target by Month 3"),
        startMonth: get("Start Month"),
        startWeek: get("Start Week"),
        endMonth: get("End Month"),
        endWeek: get("End Week"),
        impact: get("Impact (H/M/L)"),
        effort: get("Effort / Complexity (H/M/L)"),
        dependencies: get("Dependencies"),
        budgetEstimate: get("Budget / Cost Estimate"),
        riskBlockers: get("Risk / Blockers"),
        validationMethod: get("Validation Method"),
        owner: get("Owner"),
        priority: get("Priority"),
        status: get("Status"),
        comments: get("Comments"),
        _rowNumber: rowNumber,
      };

      const requiredFields = [
        mapped.phase,
        mapped.area,
        mapped.action,
        mapped.owner,
        mapped.startMonth,
        mapped.startWeek,
        mapped.status,
      ];
      if (requiredFields.some((v) => !normalizeText(v))) {
        rows.push({ ...mapped, _skip: true, _reason: "Missing required fields" });
      } else {
        rows.push(mapped);
      }
    });

    const client = await pool.connect();
    const summary = { insertedCount: 0, updatedCount: 0, skippedCount: 0, errors: [] };
    const previewRows = [];

    try {
      if (!previewOnly) {
        await client.query("BEGIN");
      }

      // existing map
      const existing = await client.query(
        `SELECT id, phase, area, action, owner_name, start_month, start_week FROM action_plan_3m`
      );
      const existingMap = new Map();
      existing.rows.forEach((r) =>
        existingMap.set(
          makeActionPlanKey({
            phase: r.phase,
            area: r.area,
            action: r.action,
            owner: r.owner_name,
            startMonth: r.start_month,
            startWeek: r.start_week,
          }),
          r.id
        )
      );

      for (const mapped of rows) {
        if (mapped._skip) {
          summary.skippedCount += 1;
          summary.errors.push({ row: mapped._rowNumber, reason: mapped._reason });
          continue;
        }
        const key = makeActionPlanKey(mapped);
        const payload = mapActionPlanRow(mapped);
        const existingId = existingMap.get(key);
        if (existingId) {
          summary.updatedCount += 1;
          if (!previewOnly) {
            await client.query(
              `
                UPDATE action_plan_3m
                SET phase=$1, area=$2, action=$3, description=$4, kpi_metric=$5, kpi_target_m3=$6,
                    start_month=$7, start_week=$8, end_month=$9, end_week=$10, impact=$11, effort=$12,
                    dependencies=$13, budget_estimate=$14, risk_blockers=$15, validation_method=$16,
                    owner_name=$17, priority=$18, status=$19, comments=$20, updated_at=NOW()
                WHERE id=$21
              `,
              [
                payload.phase,
                payload.area,
                payload.action,
                payload.description || null,
                payload.kpiMetric || null,
                payload.kpiTargetM3 || null,
                payload.startMonth || null,
                payload.startWeek || null,
                payload.endMonth || null,
                payload.endWeek || null,
                payload.impact || null,
                payload.effort || null,
                payload.dependencies || null,
                payload.budgetEstimate || null,
                payload.riskBlockers || null,
                payload.validationMethod || null,
                payload.owner || null,
                payload.priority || null,
                payload.status || null,
                payload.comments || null,
                existingId,
              ]
            );
          }
        } else {
          summary.insertedCount += 1;
          if (!previewOnly) {
            await client.query(
              `
                INSERT INTO action_plan_3m (
                  phase, area, action, description, kpi_metric, kpi_target_m3,
                  start_month, start_week, end_month, end_week, impact, effort,
                  dependencies, budget_estimate, risk_blockers, validation_method,
                  owner_name, priority, status, comments
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
              `,
              [
                payload.phase,
                payload.area,
                payload.action,
                payload.description || null,
                payload.kpiMetric || null,
                payload.kpiTargetM3 || null,
                payload.startMonth || null,
                payload.startWeek || null,
                payload.endMonth || null,
                payload.endWeek || null,
                payload.impact || null,
                payload.effort || null,
                payload.dependencies || null,
                payload.budgetEstimate || null,
                payload.riskBlockers || null,
                payload.validationMethod || null,
                payload.owner || null,
                payload.priority || null,
                payload.status || null,
                payload.comments || null,
              ]
            );
          }
        }

        if (previewRows.length < 50) {
          previewRows.push({
            phase: mapped.phase,
            area: mapped.area,
            action: mapped.action,
            owner: mapped.owner,
            status: mapped.status,
            priority: mapped.priority,
            start: `${mapped.startMonth} / ${mapped.startWeek}`,
            end: `${mapped.endMonth} / ${mapped.endWeek}`,
          });
        }
      }

      if (!previewOnly) {
        await client.query("COMMIT");
      }

      res.json({
        ok: true,
        fileName: fileName || null,
        insertedCount: summary.insertedCount,
        updatedCount: summary.updatedCount,
        skippedCount: summary.skippedCount,
        errors: summary.errors,
        previewRows,
        totalRows: rows.length,
      });
    } catch (err) {
      if (!previewOnly) {
        await client.query("ROLLBACK");
      }
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Action plan import error:", err);
    res.status(500).json({ error: "IMPORT_FAILED", message: err.message });
  }
});

app.get("/api/action-plan/summary", async (_req, res) => {
  if (!pool) {
    return res
      .status(503)
      .json({ error: "DB_NOT_CONFIGURED", message: "DATABASE_URL missing" });
  }
  try {
    const { rows } = await pool.query(
      `
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status ILIKE 'completed%') AS completed,
          COUNT(*) FILTER (WHERE status ILIKE 'in progress%') AS in_progress,
          COUNT(*) FILTER (WHERE status ILIKE 'blocked%') AS blocked
        FROM action_plan_3m
      `
    );

    const matrix = await pool.query(
      `
        SELECT area, status, COUNT(*) as count
        FROM action_plan_3m
        GROUP BY area, status
      `
    );

    res.json({
      ok: true,
      summary: rows[0] || {},
      matrix: matrix.rows || [],
    });
  } catch (err) {
    console.error("Action plan summary error:", err);
    res.status(500).json({ error: "FETCH_FAILED", message: err.message });
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
