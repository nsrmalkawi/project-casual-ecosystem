// src/utils/actionPlan.js

export function addActionFromInsight(payload) {
  if (typeof window === "undefined") return;

  const { source, brand, outlet, issue, owner, dueDate, kpi } = payload || {};

  try {
    const key = "pc_action_plan";
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(parsed) ? parsed : [];

    const now = new Date();
    const id =
      now.getTime().toString() + "-" + Math.random().toString(16).slice(2);

    const newRow = {
      id,
      createdAt: now.toISOString(),
      source: source || "Insight",
      brand: brand || "",
      outlet: outlet || "",
      issue: issue || "",
      owner: owner || "",
      dueDate: dueDate || "",
      kpi: kpi || "",
      status: "Planned",
      priority: "Medium",
      notes: "",
    };

    const next = [...list, newRow];
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch (e) {
    console.error("Failed to append action to pc_action_plan", e);
  }
}
