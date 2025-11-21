// src/utils/aiClient.js

// In production, set VITE_AI_SERVER_URL to your deployed server base URL.
// Locally, this falls back to http://localhost:5174
const API_BASE =
  import.meta.env.VITE_AI_SERVER_URL || "http://localhost:5174";

/**
 * Generic AI call helper.
 * @param {Object} params
 * @param {string} params.mode - e.g. "summary", "anomaly", "actionPlan", "menuActions", "cashflowExplain", "free"
 * @param {Object} params.payload - JSON with metrics / data snapshot
 * @param {string} [params.question] - Optional free-form question
 */
export async function callAi({ mode, payload, question }) {
  if (!payload) {
    throw new Error("callAi requires a payload object.");
  }

  const url = `${API_BASE}/api/ai-report`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mode,
      payload,
      question,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `AI request failed: ${res.status} ${res.statusText} - ${text}`
    );
  }

  const data = await res.json();
  return data; // { text: string }
}
