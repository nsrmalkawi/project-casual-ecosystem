import express from "express";
import cors from "cors";
import dotenv from "dotenv";

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
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
];

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
  res.json({
    ok: true,
    model: PRIMARY_MODEL,
    fallbacks: FALLBACK_MODELS,
    hasApiKey: !!GEMINI_API_KEY,
    env: process.env.NODE_ENV || "development",
  });
});

app.listen(port, () => {
  console.log(
    `AI server listening on port ${port} | primary model=${PRIMARY_MODEL} | fallbacks=${FALLBACK_MODELS.join(
      ", "
    )} | hasApiKey=${!!GEMINI_API_KEY}`
  );
});
