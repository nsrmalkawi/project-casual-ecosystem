// server.mjs
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
app.use(
  cors({
    origin: "*", // you can restrict later to your frontend domain
  })
);
app.use(express.json());

// ---- GEMINI SETUP ----
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn(
    "WARNING: GEMINI_API_KEY is not set. AI endpoints will return errors."
  );
}

let model = null;
if (apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey);
  // You already confirmed this works:
  // change model name here only if you want another one (and it's supported).
  model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-lite",
  });
}

// ---- HEALTH CHECK ----
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    geminiKeyLoaded: !!apiKey,
    model: model ? "gemini-2.0-flash-lite" : null,
  });
});

// ---- PROMPT BUILDER ----
function buildPrompt(mode, payload, question) {
  const baseContext = `
You are a senior F&B performance analyst working on "Project Casual", a group of casual dining concepts.
You receive structured JSON with sales, costs, waste, labor, rent/opex, petty cash, menu data, targets, etc.
Always respond in clear, concise bullet points without JSON in the answer.
Assume the business is in Jordan and prices are in JOD.
If something is missing or zero, just mention it briefly and focus on what is available.
`;

  const jsonBlock = JSON.stringify(payload, null, 2);

  switch (mode) {
    case "summary":
      return `
${baseContext}
Task: Provide a concise performance summary for this period and filter (brand/outlet/date).
Focus on:
- Overall sales, key cost buckets, EBITDA and EBITDA %
- Major issues or red flags
- 3–5 key talking points for management

JSON data:
${jsonBlock}
`;

    case "anomaly":
      return `
${baseContext}
Task: Scan the data for anomalies and "strange patterns".
Highlight:
- Outlets or brands with unusually high food or labor cost
- Negative EBITDA or very low margins
- Unusual spikes or drops by date
- Any suspicious data quality issues

Output:
- Bullet list of anomalies with short explanation and possible root causes.

JSON data:
${jsonBlock}
`;

    case "actionPlan":
      return `
${baseContext}
Task: Turn the current metrics into a practical improvement action plan.
Focus on:
- Waste reduction
- Food cost optimization (purchasing, portioning, menu engineering)
- Labor scheduling and productivity
- Rent/opex discipline
- Any urgent actions for loss-making outlets

Output format:
- 5–10 bullet points: [Area] – [Concrete action] – [Expected KPI impact].

JSON data:
${jsonBlock}
`;

    case "menuActions":
      return `
${baseContext}
You are a menu engineering expert (Stars, Plowhorses, Puzzles, Dogs).

Task:
Based on the JSON menu engineering metrics (popularity, margin, etc.), suggest actions for each category type:
- Which items to promote or upsell
- Which items to reprice
- Which items to rework or remove
- Any cross-selling or bundling ideas

Keep it practical and short.

JSON data:
${jsonBlock}
`;

    case "cashflowExplain":
      return `
${baseContext}
Task: Explain the recent and forecasted cash flow situation.
Focus on:
- Main sources of cash in
- Main cash outflows (suppliers, rent, payroll, etc.)
- Whether a cash crunch is expected in the next 3–6 months
- Clear recommendations for owners (delay capex, negotiate terms, etc.)

JSON data:
${jsonBlock}
`;

    case "free":
      return `
${baseContext}
The user question is:
"${question || ""}"

Use the JSON data as context to answer.

JSON data:
${jsonBlock}
`;

    default:
      // Fallback generic analysis
      return `
${baseContext}
Task: Provide a concise analysis and recommendations for Project Casual based on this data.
Highlight performance, red flags, and next steps.

JSON data:
${jsonBlock}
`;
  }
}

// ---- MAIN AI ENDPOINT ----
app.post("/api/ai-report", async (req, res) => {
  try {
    if (!model) {
      return res.status(500).json({
        error: "AI_REPORT_ERROR",
        message: "GEMINI_API_KEY is not set or model is not initialized.",
      });
    }

    const { mode, payload, question } = req.body || {};

    if (!payload) {
      return res.status(400).json({
        error: "MISSING_PAYLOAD",
        message: "Request body must include a 'payload' object.",
      });
    }

    const prompt = buildPrompt(mode, payload, question);

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
    });

    const response = result?.response;
    const parts = response?.candidates?.[0]?.content?.parts || [];
    const text = parts
      .map((p) => (typeof p.text === "string" ? p.text : ""))
      .join("\n")
      .trim();

    res.json({ text });
  } catch (err) {
    console.error("AI_REPORT_ERROR:", err);
    res.status(500).json({
      error: "AI_REPORT_ERROR",
      message: err.message || "Unknown AI error",
    });
  }
});

// ---- START SERVER ----
const PORT = process.env.PORT || 5174;

app.listen(PORT, () => {
  console.log(`AI report server listening on http://localhost:${PORT}`);
});
