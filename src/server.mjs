// server.mjs
import "dotenv/config";
import express from "express";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";

const PORT = process.env.PORT || 5174;
const API_KEY = process.env.GEMINI_API_KEY;

// Debug log to verify env is loaded
console.log("GEMINI_API_KEY loaded:", !!API_KEY);

if (!API_KEY) {
  console.error(
    "GEMINI_API_KEY is not set in environment variables (.env). " +
      "Make sure .env is in the project root and you restarted the server."
  );
}

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;
const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    geminiKeyLoaded: !!API_KEY,
  });
});

// Helper to call Gemini safely
async function runGemini(mode, payload, question) {
  if (!genAI || !API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is not set in environment variables (.env)."
    );
  }

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
  });

  let prompt = "";

  if (mode === "report") {
    prompt =
      "You are an F&B performance analyst. Based on the JSON data below, " +
      "write a concise, bullet-style management report with clear headings " +
      "covering: performance overview, key issues, improvement opportunities, " +
      "and urgent red flags.\n\nJSON DATA:\n" +
      JSON.stringify(payload, null, 2);
  } else if (mode === "scenario") {
    prompt =
      "You are an F&B financial analyst. Explain the difference between the " +
      "base and scenario for this restaurant group. Focus on sales, food cost, " +
      "labor, rent/opex, petty cash, and EBITDA, with a practical tone.\n\n" +
      "BASE & SCENARIO JSON:\n" +
      JSON.stringify(payload, null, 2);
  } else if (mode === "viewExplain") {
    prompt =
      "You are an F&B expert. Explain what this view is telling us and " +
      "summarize the most important insights and priorities.\n\nVIEW JSON:\n" +
      JSON.stringify(payload, null, 2);
  } else if (mode === "qa") {
    prompt =
      "Context JSON:\n" +
      JSON.stringify(payload, null, 2) +
      "\n\nUser question:\n" +
      (question || "Explain the most important insights and actions.");
  } else {
    prompt =
      "Analyze this JSON data and summarize the most important insights and actions.\n\n" +
      JSON.stringify(payload, null, 2);
  }

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();
  return text;
}

app.post("/api/ai-report", async (req, res) => {
  try {
    const { mode, payload, question } = req.body || {};

    if (!API_KEY) {
      return res.status(500).json({
        error: "AI_REPORT_ERROR",
        message:
          "GEMINI_API_KEY is not set in environment variables (.env).",
      });
    }

    if (!payload) {
      return res.status(400).json({
        error: "AI_REPORT_ERROR",
        message: "Missing payload in request body.",
      });
    }

    const text = await runGemini(mode || "report", payload, question);

    res.json({ ok: true, text });
  } catch (err) {
    console.error("AI error:", err);
    res.status(500).json({
      error: "AI_REPORT_ERROR",
      message: err.message || "Unknown AI error",
    });
  }
});

app.listen(PORT, () => {
  console.log(`AI report server listening on http://localhost:${PORT}`);
});
