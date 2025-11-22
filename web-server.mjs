// web-server.mjs
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5174;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const distPath = path.join(__dirname, "dist");
console.log("Serving static files from:", distPath);
app.use(express.static(distPath));

const hasKey = !!process.env.GEMINI_API_KEY;
const genAI = hasKey ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const modelName = "gemini-2.0-flash-lite";

async function runModel(prompt) {
  if (!hasKey || !genAI) {
    throw new Error("GEMINI_API_KEY is not set or invalid");
  }

  const model = genAI.getGenerativeModel({ model: modelName });

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
  });

  const text = result.response.text();
  return text || "";
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    geminiKeyLoaded: hasKey,
    model: hasKey ? modelName : null,
    env: process.env.NODE_ENV || "development",
  });
});

app.post("/api/ai-report", async (req, res) => {
  try {
    const payload = req.body?.payload || req.body || {};
    const json = JSON.stringify(payload, null, 2);

    const prompt = `
You are a senior F&B performance analyst for a multi-brand restaurant group.
You receive JSON data with KPIs (sales, food cost, labor, rent, EBITDA, etc.)
across outlets and brands.

Data (JSON):
${json}

Tasks:
1) Provide a concise summary (3–6 bullet points) of overall performance.
2) Highlight main problems and risks (loss-making outlets, high costs, trends).
3) List concrete actions (each in 1 line) with outlet/brand and KPI to watch.

Keep it practical and focused. Reply as plain text (no JSON).
    `.trim();

    const text = await runModel(prompt);
    res.json({ text });
  } catch (err) {
    console.error("AI_REPORT_ERROR", err);
    res.status(500).json({
      error: "AI_REPORT_ERROR",
      message: err.message || "Failed to generate AI report",
    });
  }
});

app.post("/api/ai-menu-actions", async (req, res) => {
  try {
    const payload = req.body || {};
    const json = JSON.stringify(payload, null, 2);

    const prompt = `
You are a menu engineering expert for restaurants.
You receive JSON with menu items, their popularity and profitability,
and classification (Star, Plowhorse, Puzzle, Dog).

Data (JSON):
${json}

Tasks:
1) For each item (or group), propose 1–2 specific actions:
   - Increase price / Decrease portion / Promote / Rework recipe / Remove / Bundle, etc.
2) Prioritize the 5–10 most impactful actions for improving EBITDA.
3) Mention outlet/brand where relevant.

Reply as simple bullet points.
    `.trim();

    const text = await runModel(prompt);
    res.json({ text });
  } catch (err) {
    console.error("AI_MENU_ACTIONS_ERROR", err);
    res.status(500).json({
      error: "AI_MENU_ACTIONS_ERROR",
      message: err.message || "Failed to get AI menu actions",
    });
  }
});

app.post("/api/ai-unusual-metrics", async (req, res) => {
  try {
    const payload = req.body || {};
    const json = JSON.stringify(payload, null, 2);

    const prompt = `
You are a data anomaly detector for an F&B group.
You receive compressed metrics (by outlet, brand, date) including sales,
food cost %, labor %, rent, EBITDA, and other ratios.

Data (JSON):
${json}

Tasks:
1) Identify outlets, brands, or dates that look unusual or risky
   (e.g. sudden margin drops, negative EBITDA, extreme cost %).
2) For each unusual point, write 1–2 short bullets:
   - What is strange
   - Possible causes to check
3) Suggest which issues should be turned into action plan items.

Reply as a bullet list grouped by outlet/brand.
    `.trim();

    const text = await runModel(prompt);
    res.json({ text });
  } catch (err) {
    console.error("AI_UNUSUAL_METRICS_ERROR", err);
    res.status(500).json({
      error: "AI_UNUSUAL_METRICS_ERROR",
      message: err.message || "Failed to get AI anomalies",
    });
  }
});

app.post("/api/ai-explain", async (req, res) => {
  try {
    const { context, question } = req.body || {};
    const json = JSON.stringify(context || {}, null, 2);

    const prompt = `
You are an F&B analyst.
User has a dashboard and asks a question.

Context (JSON, KPIs, filters, etc.):
${json}

User question:
${question || "No question provided."}

Explain in clear, simple language:
- What the data is saying
- Why this might be happening
- Which 2–3 actions they should consider

Reply in 2–4 short paragraphs + bullet actions.
    `.trim();

    const text = await runModel(prompt);
    res.json({ text });
  } catch (err) {
    console.error("AI_EXPLAIN_ERROR", err);
    res.status(500).json({
      error: "AI_EXPLAIN_ERROR",
      message: err.message || "Failed to get AI explanation",
    });
  }
});

// SPA fallback: serve React app for all non-API routes
app.get(/^(?!\/api\/).*/, (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(
    `Project Casual ecosystem server listening on http://localhost:${PORT}`
  );
});
