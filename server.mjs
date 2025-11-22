// server.mjs
// Unified API + static server for Project Casual Ecosystem
// - Serves built Vite app from /dist
// - AI endpoints using Gemini
// - Snapshot "cloud DB" endpoints using snapshot.json
// - SPA fallback route using RegExp to avoid path-to-regexp errors

import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

// -----------------------------------------------------------------------------
// Paths / basic setup
// -----------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5170;

app.use(cors());
app.use(express.json());

// File used as simple "cloud DB" snapshot on server
const SNAPSHOT_FILE = path.join(__dirname, "snapshot.json");
const USERS_FILE = path.join(__dirname, "users.json");

// Load users from JSON file
function loadUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) {
      return [];
    }
    const raw = fs.readFileSync(USERS_FILE, "utf8");
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (err) {
    console.error("Failed to load users:", err);
    return [];
  }
}

// Save users back to JSON file
function saveUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to save users:", err);
  }
}
// -----------------------------------------------------------------------------
// Gemini setup
// -----------------------------------------------------------------------------
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn(
    "GEMINI_API_KEY is not set in environment variables. " +
      "AI endpoints will return an error until you set it."
  );
}

let geminiModel = null;

if (GEMINI_API_KEY) {
  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    // If you want, you can switch to "gemini-1.5-pro" later.
    geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  } catch (err) {
    console.error("Failed to initialize GoogleGenerativeAI:", err);
  }
}

async function runGemini(prompt) {
  if (!geminiModel) {
    throw new Error(
      "GEMINI_API_KEY is not set in environment variables (.env)."
    );
  }
  const result = await geminiModel.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

// -----------------------------------------------------------------------------
// AI endpoints
// -----------------------------------------------------------------------------

// 1) AI report for overall performance
app.post("/api/ai-report", async (req, res) => {
  try {
    const payload = req.body || {};
    const prettyJson = JSON.stringify(payload, null, 2);

    const prompt = `
You are a senior F&B performance analyst.

You will receive JSON with high-level metrics, KPIs, and anomalies
from a group of casual restaurants (Project Casual).

JSON data:
${prettyJson}

Write a concise performance report with:
- A short executive summary (2–3 bullet points)
- Key positives
- Key issues / red flags
- Clear recommended next actions (prioritised)

Keep it practical and business-focused.
    `.trim();

    const text = await runGemini(prompt);

    res.json({ text });
  } catch (err) {
    console.error("AI_REPORT_ERROR /api/ai-report:", err);
    res.status(500).json({
      error: "AI_REPORT_ERROR",
      message: err.message || "Unknown AI error",
    });
  }
});

// 2) AI menu actions (menu engineering suggestions)
app.post("/api/ai-menu-actions", async (req, res) => {
  try {
    const payload = req.body || {};
    const prettyJson = JSON.stringify(payload, null, 2);

    const prompt = `
You are a restaurant menu engineering expert.

User is working on Project Casual (multi-brand casual dining).
They send you JSON containing menu items, contribution margins,
popularity, and flags (like Stars / Plowhorses / Puzzles / Dogs).

JSON:
${prettyJson}

Task:
1) Propose concrete actions per item or category, such as:
   - Increase price by X%
   - Promote as hero item
   - Rework recipe / portion
   - Consider removing from menu
2) Highlight any quick wins and any big structural issues.
Respond as a numbered list of short, direct action bullets.
    `.trim();

    const text = await runGemini(prompt);

    // Try to split AI text into actions array, but keep raw text too.
    const actions = text
      .split("\n")
      .map((line) => line.replace(/^\d+[\).\s-]*/, "").trim())
      .filter((line) => line.length > 0);

    res.json({ text, actions });
  } catch (err) {
    console.error("AI_REPORT_ERROR /api/ai-menu-actions:", err);
    res.status(500).json({
      error: "AI_REPORT_ERROR",
      message: err.message || "Unknown AI error",
    });
  }
});

// 3) AI explanation for anomalies (e.g., weird KPIs)
app.post("/api/ai-explain", async (req, res) => {
  try {
    const payload = req.body || {};
    const prettyJson = JSON.stringify(payload, null, 2);

    const prompt = `
You are an F&B data coach.

The user is looking at one anomaly or suspicious pattern in their data.
They send you JSON describing the anomaly context.

JSON:
${prettyJson}

Explain:
- Possible operational causes, in plain language
- What they should check in-store or in reports
- 2–3 concrete follow-up actions

Be clear, practical, and not too long.
    `.trim();

    const text = await runGemini(prompt);
    res.json({ text });
  } catch (err) {
    console.error("AI_REPORT_ERROR /api/ai-explain:", err);
    res.status(500).json({
      error: "AI_REPORT_ERROR",
      message: err.message || "Unknown AI error",
    });
  }
});

// -----------------------------------------------------------------------------
// Snapshot "cloud DB" endpoints (JSON file on server)
// -----------------------------------------------------------------------------

// GET current snapshot: returns { data: {...pc_* keys...} } or { data: null }
app.get("/api/snapshot", (req, res) => {
  try {
    if (!fs.existsSync(SNAPSHOT_FILE)) {
      return res.json({ data: null });
    }
    const raw = fs.readFileSync(SNAPSHOT_FILE, "utf8");
    const parsed = raw ? JSON.parse(raw) : {};
    res.json(parsed);
  } catch (err) {
    console.error("Error reading snapshot:", err);
    res.status(500).json({ error: "Failed to read snapshot" });
  }
});

// POST save snapshot: expects { data: {...pc_* data...} }
app.post("/api/snapshot", (req, res) => {
  try {
    const payload = req.body || {};
    fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(payload, null, 2), "utf8");
    res.json({ ok: true });
  } catch (err) {
    console.error("Error writing snapshot:", err);
    res.status(500).json({ error: "Failed to write snapshot" });
  }
});
// -----------------------------------------------------------------------------
// User management / auth endpoints
// -----------------------------------------------------------------------------

// Login: POST /api/login  { username, password }
app.post("/api/login", (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "USERNAME_PASSWORD_REQUIRED" });
    }

    const users = loadUsers();
    const user = users.find((u) => u.username === username);

    if (!user || user.password !== password) {
      return res.status(401).json({ error: "INVALID_CREDENTIALS" });
    }

    // For now we just return role and username (no JWT).
    return res.json({
      username: user.username,
      role: user.role || "viewer",
    });
  } catch (err) {
    console.error("LOGIN_ERROR:", err);
    res.status(500).json({ error: "LOGIN_ERROR" });
  }
});

// Get users list (for Admin UI). Do NOT expose passwords.
app.get("/api/users", (req, res) => {
  try {
    const users = loadUsers().map((u) => ({
      username: u.username,
      role: u.role || "viewer",
    }));
    res.json({ users });
  } catch (err) {
    console.error("GET_USERS_ERROR:", err);
    res.status(500).json({ error: "GET_USERS_ERROR" });
  }
});

// Update password or role (Admin only, front-end will gate this).
// POST /api/users/update
// body: { username, newPassword?, newRole? }
app.post("/api/users/update", (req, res) => {
  try {
    const { username, newPassword, newRole } = req.body || {};
    if (!username) {
      return res.status(400).json({ error: "USERNAME_REQUIRED" });
    }

    const users = loadUsers();
    const idx = users.findIndex((u) => u.username === username);
    if (idx === -1) {
      return res.status(404).json({ error: "USER_NOT_FOUND" });
    }

    const user = { ...users[idx] };

    if (typeof newPassword === "string" && newPassword.trim().length >= 6) {
      user.password = newPassword.trim();
    }

    if (typeof newRole === "string" && newRole.trim()) {
      user.role = newRole.trim();
    }

    users[idx] = user;
    saveUsers(users);

    res.json({
      ok: true,
      user: { username: user.username, role: user.role },
    });
  } catch (err) {
    console.error("UPDATE_USER_ERROR:", err);
    res.status(500).json({ error: "UPDATE_USER_ERROR" });
  }
});

// -----------------------------------------------------------------------------
// Static file serving (dist) + SPA fallback
// -----------------------------------------------------------------------------

const distPath = path.join(__dirname, "dist");
if (fs.existsSync(distPath)) {
  console.log("Serving static files from:", distPath);
  app.use(express.static(distPath));
} else {
  console.warn("dist folder not found. Build the client with `npm run build`.");
}

// SPA fallback: use RegExp instead of "*" to avoid path-to-regexp error
app.get(/.*/, (req, res) => {
  const indexPath = path.join(distPath, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send("index.html not found. Did you run `npm run build`?");
  }
});

// -----------------------------------------------------------------------------
// Start server
// -----------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
