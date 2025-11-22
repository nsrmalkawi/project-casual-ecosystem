// src/utils/aiClient.js
//
// Small helper to call your backend AI endpoints from the React app.
// All AI calls go to the Node server (same origin) which talks to Gemini.

const API_BASE = ""; // same-origin; no need to change

async function callAIEndpoint(path, payload) {
  try {
    const resp = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload || {}),
    });

    if (!resp.ok) {
      let text = "";
      try {
        text = await resp.text();
      } catch {
        // ignore
      }
      throw new Error(
        `AI request failed: ${resp.status} ${
          resp.statusText || ""
        } - ${text}`
      );
    }

    const data = await resp.json();
    return data;
  } catch (err) {
    console.error("AI endpoint error:", err);
    // Re-throw for the UI to handle and show friendly messages
    throw err;
  }
}

/**
 * Backwards-compatible helper used by older code:
 * callAi("/api/ai-report", payload) etc.
 */
export async function callAi(path, payload) {
  return callAIEndpoint(path, payload);
}

/**
 * Generate an AI narrative report for the overall ecosystem.
 * Used in ReportsHub (Generate AI Report).
 */
export async function fetchAIReport(payload) {
  // expected payload shape:
  // {
  //   metricsSummary,
  //   filters,
  //   periodLabel,
  //   outlet,
  //   brand
  // }
  const data = await callAIEndpoint("/api/ai-report", payload);
  // server returns { reportText }
  return data;
}

/**
 * Ask AI for menu engineering / actions suggestions.
 * Used in MenuEngineeringHub.
 */
export async function fetchAIMenuActions(payload) {
  // expected payload shape:
  // {
  //   menuItems, // array of { name, popularity, margin, category, ... }
  //   context   // { brand, outlet, periodLabel, ... }
  // }
  const data = await callAIEndpoint("/api/ai-menu-actions", payload);
  // server returns { actions: [...] }
  return data;
}

/**
 * Ask AI to explain a specific anomaly, variance or KPI issue.
 * Used in ReportsHub "Explain with AI" / anomaly helper.
 */
export async function fetchAIExplanation(payload) {
  // expected payload shape:
  // {
  //   metricKey,
  //   metricLabel,
  //   details,      // any extra numbers / context
  //   filters,
  //   periodLabel
  // }
  const data = await callAIEndpoint("/api/ai-explanation", payload);
  // server returns { explanation }
  return data;
}

// Optional default export if any file uses `import aiClient from ...`
const aiClient = {
  callAi,
  fetchAIReport,
  fetchAIMenuActions,
  fetchAIExplanation,
};

export default aiClient;
