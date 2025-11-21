// src/features/action-plan/ActionPlanHub.jsx
import { useEffect, useMemo, useState } from "react";
import { callAi } from "../../utils/aiClient";

const STORAGE_KEY = "pc_action_plan";

function loadArray(key) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveArray(key, arr) {
  try {
    window.localStorage.setItem(key, JSON.stringify(arr));
  } catch (e) {
    console.error("Failed to save", key, e);
  }
}

function makeId() {
  return (
    Date.now().toString() +
    "-" +
    Math.random().toString(16).slice(2)
  );
}

function ActionPlanHub() {
  const [actions, setActions] = useState([]);

  const [draft, setDraft] = useState({
    id: null,
    title: "",
    area: "",
    brand: "",
    outlet: "",
    owner: "",
    status: "Planned",
    priority: "Medium",
    startDate: "",
    dueDate: "",
    followUpFrequency: "",
    kpiToWatch: "",
    notes: "",
  });

  const [aiContext, setAiContext] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    setActions(loadArray(STORAGE_KEY));
  }, []);

  useEffect(() => {
    saveArray(STORAGE_KEY, actions);
  }, [actions]);

  const todayStr = new Date().toISOString().slice(0, 10);

  const summary = useMemo(() => {
    let planned = 0;
    let inProgress = 0;
    let done = 0;
    let overdue = 0;

    actions.forEach((a) => {
      const st = a.status || "Planned";
      if (st === "Done") done += 1;
      else if (st === "In Progress") inProgress += 1;
      else planned += 1;

      if (
        a.dueDate &&
        a.dueDate < todayStr &&
        st !== "Done"
      ) {
        overdue += 1;
      }
    });

    return {
      total: actions.length,
      planned,
      inProgress,
      done,
      overdue,
    };
  }, [actions, todayStr]);

  function handleDraftChange(field, value) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  function resetDraft() {
    setDraft({
      id: null,
      title: "",
      area: "",
      brand: "",
      outlet: "",
      owner: "",
      status: "Planned",
      priority: "Medium",
      startDate: "",
      dueDate: "",
      followUpFrequency: "",
      kpiToWatch: "",
      notes: "",
    });
  }

  function handleSaveAction(e) {
    if (e) e.preventDefault();
    if (!draft.title.trim()) return;

    const actionToSave = {
      ...draft,
      id: draft.id || makeId(),
      createdAt: draft.createdAt || todayStr,
    };

    setActions((prev) => {
      const idx = prev.findIndex(
        (a) => a.id === actionToSave.id
      );
      if (idx === -1) {
        return [...prev, actionToSave];
      }
      const copy = [...prev];
      copy[idx] = actionToSave;
      return copy;
    });

    resetDraft();
  }

  function handleEditAction(action) {
    setDraft({ ...action });
  }

  function handleDeleteAction(id) {
    setActions((prev) => prev.filter((a) => a.id !== id));
    if (draft.id === id) resetDraft();
  }

  async function handleAiSuggestActions() {
    try {
      setAiLoading(true);
      setAiSuggestions("");

      const sales = loadArray("pc_sales");
      const purchases = loadArray("pc_purchases");
      const waste = loadArray("pc_waste");
      const hr = loadArray("pc_hr_labor");
      const rentOpex = loadArray("pc_rent_opex");
      const pettyCash = loadArray("pc_petty_cash");

      const payload = {
        contextNote: aiContext || "",
        sales,
        purchases,
        waste,
        hr,
        rentOpex,
        pettyCash,
      };

      const question =
        "Propose 4–8 concrete, actionable improvement actions for this F&B business. " +
        "Each action should be specific (what to do, where, and why), and relevant to the data. " +
        "Write them as bullet points that I can convert into tasks in the action plan.";

      const res = await callAi({
        mode: "qa",
        payload,
        question,
      });

      setAiSuggestions(res.text || "");
    } catch (err) {
      setAiSuggestions(
        `Failed to get AI action ideas: ${
          err.message || "Unknown error"
        }`
      );
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div>
      <h2 className="page-title">Action Plan Tracker</h2>
      <p className="page-subtitle">
        Track your Project Casual enhancement plan: owners,
        deadlines, KPIs, and follow-up. Use AI to brainstorm new
        actions.
      </p>

      {/* Summary */}
      <div
        className="card"
        style={{
          display: "flex",
          gap: 24,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <div>
          <div className="field-label">Total actions</div>
          <div style={{ fontWeight: 600 }}>
            {summary.total}
          </div>
        </div>
        <div>
          <div className="field-label">Planned</div>
          <div>{summary.planned}</div>
        </div>
        <div>
          <div className="field-label">In progress</div>
          <div>{summary.inProgress}</div>
        </div>
        <div>
          <div className="field-label">Done</div>
          <div>{summary.done}</div>
        </div>
        <div>
          <div className="field-label">Overdue</div>
          <div style={{ color: "#b91c1c" }}>
            {summary.overdue}
          </div>
        </div>
      </div>

      {/* Layout: left = form + table, right = AI */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2.2fr) minmax(0, 1.6fr)",
          gap: 16,
        }}
      >
        {/* Form + table */}
        <div
          style={{
            display: "grid",
            gridTemplateRows: "minmax(0, 1.2fr) minmax(0, 2fr)",
            gap: 16,
          }}
        >
          <div className="card">
            <h3 className="card-title">
              Add / Edit Action
            </h3>
            <form
              onSubmit={handleSaveAction}
              style={{
                display: "grid",
                gap: 8,
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(180px, 1fr))",
              }}
            >
              <div>
                <label className="field-label">
                  Action title
                </label>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(e) =>
                    handleDraftChange(
                      "title",
                      e.target.value
                    )
                  }
                  placeholder="Reduce food cost at Outlet X"
                />
              </div>
              <div>
                <label className="field-label">Area</label>
                <input
                  type="text"
                  value={draft.area}
                  onChange={(e) =>
                    handleDraftChange(
                      "area",
                      e.target.value
                    )
                  }
                  placeholder="Food Cost, Sales, Labor..."
                />
              </div>
              <div>
                <label className="field-label">Brand</label>
                <input
                  type="text"
                  value={draft.brand}
                  onChange={(e) =>
                    handleDraftChange(
                      "brand",
                      e.target.value
                    )
                  }
                  placeholder="Brand / Concept"
                />
              </div>
              <div>
                <label className="field-label">Outlet</label>
                <input
                  type="text"
                  value={draft.outlet}
                  onChange={(e) =>
                    handleDraftChange(
                      "outlet",
                      e.target.value
                    )
                  }
                  placeholder="Abdoun, etc."
                />
              </div>
              <div>
                <label className="field-label">Owner</label>
                <input
                  type="text"
                  value={draft.owner}
                  onChange={(e) =>
                    handleDraftChange(
                      "owner",
                      e.target.value
                    )
                  }
                  placeholder="Outlet Manager, Head Chef..."
                />
              </div>
              <div>
                <label className="field-label">Status</label>
                <select
                  value={draft.status}
                  onChange={(e) =>
                    handleDraftChange(
                      "status",
                      e.target.value
                    )
                  }
                >
                  <option value="Planned">
                    Planned
                  </option>
                  <option value="In Progress">
                    In Progress
                  </option>
                  <option value="Done">Done</option>
                </select>
              </div>
              <div>
                <label className="field-label">
                  Priority
                </label>
                <select
                  value={draft.priority}
                  onChange={(e) =>
                    handleDraftChange(
                      "priority",
                      e.target.value
                    )
                  }
                >
                  <option value="High">High</option>
                  <option value="Medium">
                    Medium
                  </option>
                  <option value="Low">Low</option>
                </select>
              </div>
              <div>
                <label className="field-label">
                  Start date
                </label>
                <input
                  type="date"
                  value={draft.startDate}
                  onChange={(e) =>
                    handleDraftChange(
                      "startDate",
                      e.target.value
                    )
                  }
                />
              </div>
              <div>
                <label className="field-label">
                  Due date
                </label>
                <input
                  type="date"
                  value={draft.dueDate}
                  onChange={(e) =>
                    handleDraftChange(
                      "dueDate",
                      e.target.value
                    )
                  }
                />
              </div>
              <div>
                <label className="field-label">
                  Follow-up frequency
                </label>
                <input
                  type="text"
                  value={draft.followUpFrequency}
                  onChange={(e) =>
                    handleDraftChange(
                      "followUpFrequency",
                      e.target.value
                    )
                  }
                  placeholder="Weekly, Monthly..."
                />
              </div>
              <div>
                <label className="field-label">
                  KPI to watch
                </label>
                <input
                  type="text"
                  value={draft.kpiToWatch}
                  onChange={(e) =>
                    handleDraftChange(
                      "kpiToWatch",
                      e.target.value
                    )
                  }
                  placeholder="Food cost %, EBITDA, etc."
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="field-label">
                  Details / Notes
                </label>
                <textarea
                  rows={2}
                  value={draft.notes}
                  onChange={(e) =>
                    handleDraftChange(
                      "notes",
                      e.target.value
                    )
                  }
                  placeholder="Concrete steps, resources, constraints..."
                />
              </div>

              <div
                style={{
                  gridColumn: "1 / -1",
                  display: "flex",
                  gap: 8,
                  marginTop: 4,
                }}
              >
                <button
                  type="submit"
                  className="primary-btn"
                >
                  {draft.id ? "Update action" : "Add action"}
                </button>
                {draft.id && (
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={resetDraft}
                  >
                    Cancel edit
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="card">
            <h3 className="card-title">
              Action List
            </h3>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Area</th>
                    <th>Brand / Outlet</th>
                    <th>Owner</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Due</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {actions.length === 0 ? (
                    <tr>
                      <td colSpan="8">
                        No actions yet. Use the form above
                        to add actions.
                      </td>
                    </tr>
                  ) : (
                    actions.map((a) => {
                      const overdue =
                        a.dueDate &&
                        a.dueDate < todayStr &&
                        a.status !== "Done";
                      return (
                        <tr key={a.id}>
                          <td>{a.title}</td>
                          <td>{a.area}</td>
                          <td>
                            {a.brand}
                            {a.outlet
                              ? ` / ${a.outlet}`
                              : ""}
                          </td>
                          <td>{a.owner}</td>
                          <td>{a.status}</td>
                          <td>{a.priority}</td>
                          <td
                            style={{
                              color: overdue
                                ? "#b91c1c"
                                : undefined,
                            }}
                          >
                            {a.dueDate || "-"}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="secondary-btn"
                              onClick={() =>
                                handleEditAction(a)
                              }
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="secondary-btn"
                              style={{
                                marginLeft: 4,
                                color: "#b91c1c",
                              }}
                              onClick={() =>
                                handleDeleteAction(a.id)
                              }
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* AI Helper */}
        <div className="card">
          <h3 className="card-title">
            AI Action Ideas
          </h3>
          <p className="page-subtitle">
            Give AI some context (e.g. “Abdoun outlet has
            negative EBITDA and high food cost”) and let it
            propose concrete actions.
          </p>

          <label className="field-label">
            Context / focus area (optional)
          </label>
          <textarea
            rows={3}
            value={aiContext}
            onChange={(e) =>
              setAiContext(e.target.value)
            }
            placeholder="Example: Abdoun outlet has negative EBITDA, sales are flat vs last month, food cost is high and waste is poorly recorded..."
          />

          <button
            type="button"
            className="primary-btn"
            style={{ marginTop: 8 }}
            onClick={handleAiSuggestActions}
          >
            Ask AI for action ideas
          </button>

          {aiLoading && (
            <p style={{ marginTop: 6 }}>Thinking...</p>
          )}

          {aiSuggestions && (
            <div
              style={{
                marginTop: 10,
                fontSize: 13,
                backgroundColor: "#f1f5f9",
                padding: 10,
                borderRadius: 6,
                whiteSpace: "pre-wrap",
              }}
            >
              {aiSuggestions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ActionPlanHub;
