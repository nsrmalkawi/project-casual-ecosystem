// src/utils/aiClient.js

// In production, set VITE_API_BASE (or legacy VITE_AI_SERVER_URL) to your deployed server base URL.
// Locally, this falls back to the Vite dev server proxy target.
const API_BASE =
  import.meta.env.VITE_AI_SERVER_URL ||
  import.meta.env.VITE_API_BASE ||
  "";

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

  // Map the client-side mode to a server endpoint.
  const endpointMap = {
    menuActions: "ai-menu-actions",
    explanation: "ai-explanation",
    report: "ai-report",
    anomaly: "ai-report",
    actionPlan: "ai-report",
    qa: "ai-report",
    scenario: "ai-report",
  };

  const url = `${API_BASE}/api/${endpointMap[mode] || "ai-report"}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
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
  // Normalize shape for older callers that expected { message }
  const text = data.text || data.message || "";
  return { ...data, text };
}
