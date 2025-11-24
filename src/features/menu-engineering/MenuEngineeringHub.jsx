// src/features/menu-engineering/MenuEngineeringHub.jsx
import { useEffect, useMemo, useState } from "react";
import { marked } from "marked";
import {
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { callAi } from "../../utils/aiClient";
import { useData } from "../../DataContext";

const STORAGE_KEYS = ["pc_menu_items", "pc_recipes"];

const CLASS_COLORS = {
  Star: "#0ea5e9",
  Plowhorse: "#22c55e",
  Puzzle: "#f59e0b",
  Dog: "#ef4444",
  Unclassified: "#94a3b8",
};

function loadMenuItems() {
  const collected = [];
  for (const key of STORAGE_KEYS) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        collected.push(...parsed);
      }
    } catch {
      // ignore bad JSON and keep going
    }
  }
  return collected;
}

function mapMenuItems(rawItems) {
  return rawItems.map((r, idx) => {
    const name =
      r.menuItemName ||
      r.menuName ||
      r.itemName ||
      r.recipeName ||
      `Item ${idx + 1}`;
    const brand = r.brand || "";
    const outlet = r.outlet || "";
    const category = r.category || r.menuCategory || "";
    const menuPrice =
      Number(
        r.menuPrice ??
          r.sellingPrice ??
          r.price ??
          0
      ) || 0;
    const foodCost =
      Number(
        r.costPerPortion ??
          r.foodCost ??
          r.cost ??
          0
      ) || 0;
    let popularity =
      Number(
        r.portionsSold ??
          r.qtySold ??
          r.popularity ??
          r.salesQty ??
          0
      ) || 0;

    if (!popularity && menuPrice > 0) {
      const revenue =
        Number(r.salesRevenue ?? 0) || 0;
      if (revenue > 0)
        popularity = revenue / menuPrice;
    }

    const margin = menuPrice - foodCost;
    const marginPct =
      menuPrice > 0 ? margin / menuPrice : 0;

    return {
      id: r.id || `m-${idx}`,
      name,
      brand,
      outlet,
      category,
      menuPrice,
      foodCost,
      popularity,
      margin,
      marginPct,
    };
  });
}

function classifyItems(items) {
  if (!items.length) return [];

  const avgMarginPct =
    items.reduce((sum, i) => sum + i.marginPct, 0) /
    items.length;
  const avgPopularity =
    items.reduce((sum, i) => sum + i.popularity, 0) /
    items.length;

  return items.map((i) => {
    let classification = "Unclassified";

    if (avgMarginPct === 0 || avgPopularity === 0) {
      classification = "Unclassified";
    } else {
      const highMargin = i.marginPct >= avgMarginPct;
      const highPopularity =
        i.popularity >= avgPopularity;

      if (highMargin && highPopularity)
        classification = "Star";
      else if (!highMargin && highPopularity)
        classification = "Plowhorse";
      else if (highMargin && !highPopularity)
        classification = "Puzzle";
      else classification = "Dog";
    }

    let suggestedMove = "";
    switch (classification) {
      case "Star":
        suggestedMove =
          "Keep, feature on menu, protect quality.";
        break;
      case "Plowhorse":
        suggestedMove =
          "High volume but low margin – consider price increase, portion control, or cost reduction.";
        break;
      case "Puzzle":
        suggestedMove =
          "High margin but low volume – improve menu placement, promotion, or description.";
        break;
      case "Dog":
        suggestedMove =
          "Low margin, low volume – consider reworking or removing.";
        break;
      default:
        suggestedMove = "Review performance.";
    }

    return {
      ...i,
      classification,
      suggestedMove,
    };
  });
}

function MenuEngineeringHub() {
  const [rawItems, setRawItems] = useState([]);
  const [aiExplainText, setAiExplainText] = useState("");
  const [aiActionsText, setAiActionsText] = useState("");
  const [aiExplainLoading, setAiExplainLoading] =
    useState(false);
  const [aiActionsLoading, setAiActionsLoading] =
    useState(false);
  const [lastRefreshed, setLastRefreshed] = useState("");

  const {
    brandFilter = "",
    setBrandFilter,
    outletFilter = "",
    setOutletFilter,
  } = useData();

  useEffect(() => {
    setRawItems(loadMenuItems());
    setLastRefreshed(new Date().toLocaleString());
  }, []);

  const items = useMemo(
    () => classifyItems(mapMenuItems(rawItems)),
    [rawItems]
  );

  const groupedByClass = useMemo(() => {
    const groups = {};
    items.forEach((i) => {
      const key = i.classification || "Unclassified";
      if (!groups[key]) groups[key] = [];
      groups[key].push(i);
    });
    return groups;
  }, [items]);

  const brandOptions = useMemo(() => {
    const set = new Set();
    items.forEach((i) => {
      if (i.brand) set.add(String(i.brand));
    });
    return ["All", ...Array.from(set).sort()];
  }, [items]);

  const outletOptions = useMemo(() => {
    const set = new Set();
    items.forEach((i) => {
      if (i.outlet) set.add(String(i.outlet));
    });
    return ["All", ...Array.from(set).sort()];
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((i) => {
      const bOk =
        !brandFilter ||
        String(i.brand).toLowerCase() === brandFilter.toLowerCase();
      const oOk =
        !outletFilter ||
        String(i.outlet).toLowerCase() === outletFilter.toLowerCase();
      return bOk && oOk;
    });
  }, [items, brandFilter, outletFilter]);

  const chartData = useMemo(
    () =>
      filteredItems.map((i) => ({
        name: i.name,
        popularity: i.popularity,
        marginPct: i.marginPct * 100,
        classification: i.classification,
      })),
    [filteredItems]
  );

  const classificationSummary = useMemo(() => {
    const counts = {
      Star: 0,
      Plowhorse: 0,
      Puzzle: 0,
      Dog: 0,
      Unclassified: 0,
    };
    filteredItems.forEach((i) => {
      counts[i.classification] =
        (counts[i.classification] || 0) + 1;
    });
    return counts;
  }, [filteredItems]);

  async function handleExplainWithAI() {
    try {
      setAiExplainLoading(true);
      setAiExplainText("");

      const payload = {
        viewId: "menuEngineeringOverview",
        filters: { brandFilter, outletFilter },
        classificationSummary,
        items: filteredItems.map((i) => ({
          name: i.name,
          brand: i.brand,
          outlet: i.outlet,
          category: i.category,
          menuPrice: i.menuPrice,
          foodCost: i.foodCost,
          popularity: i.popularity,
          marginPct: i.marginPct,
          classification: i.classification,
        })),
      };

      const res = await callAi({
        mode: "explanation",
        payload,
        question:
          "Return markdown with sections: ## Menu snapshot, ## What it means (3 bullets), ## Risks (2 bullets), ## Actions (5 short bullets).",
      });

      setAiExplainText(res.text || "");
    } catch (err) {
      setAiExplainText(
        `Failed to get AI explanation: ${err.message || "Unknown error"}`
      );
    } finally {
      setAiExplainLoading(false);
    }
  }

  async function handleActionsWithAI() {
    try {
      setAiActionsLoading(true);
      setAiActionsText("");

      const payload = {
        viewId: "menuEngineeringActions",
        filters: { brandFilter, outletFilter },
        classificationSummary,
        items: filteredItems.map((i) => ({
          name: i.name,
          brand: i.brand,
          outlet: i.outlet,
          classification: i.classification,
          menuPrice: i.menuPrice,
          foodCost: i.foodCost,
          popularity: i.popularity,
          marginPct: i.marginPct,
        })),
      };

      const res = await callAi({
        mode: "menuActions",
        payload,
        question:
          "Return markdown with sections: ## Promote (top items), ## Fix/Remove (weak items), and a table Item | Class | Price | Cost | Margin% | Action.",
      });

      setAiActionsText(res.text || "");
    } catch (err) {
      setAiActionsText(
        `Failed to get AI menu actions:xxxxx ${err.message || "Unknown error"}`
      );
    } finally {
      setAiActionsLoading(false);
    }
  }

  return (
    <div>
      <h2 className="page-title">Menu Engineering</h2>
      <p className="page-subtitle">
        Classify items as Stars, Plowhorses, Puzzles, and Dogs
        based on margin and popularity. Data is pulled from your
        saved Menu Items and Recipes (cost/price/yield) in local
        storage. Use AI to interpret and suggest actions.
      </p>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <span
          style={{
            padding: "4px 8px",
            borderRadius: 8,
            background: "#e0f2fe",
            color: "#0f172a",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          Data source: Menu Items + Recipes
        </span>
        {lastRefreshed && (
          <span style={{ fontSize: 12, color: "#475569" }}>
            Last refreshed: {lastRefreshed}
          </span>
        )}
      </div>

      {/* Filters */}
      <div
        className="card"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <label className="field-label">Brand</label>
          <select
            value={brandFilter || ""}
            onChange={(e) => setBrandFilter(e.target.value)}
          >
            {brandOptions.map((b) => (
              <option key={b} value={b === "All" ? "" : b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Outlet</label>
          <select
            value={outletFilter || ""}
            onChange={(e) => setOutletFilter(e.target.value)}
          >
            {outletOptions.map((o) => (
              <option key={o} value={o === "All" ? "" : o}>
                {o}
              </option>
            ))}
          </select>
        </div>
        <div style={{ alignSelf: "flex-end" }}>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => setRawItems(loadMenuItems())}
          >
            Refresh menu items
          </button>
          <button
            type="button"
            className="secondary-btn"
            style={{ marginLeft: 6 }}
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("pc:navigate", { detail: "recipes" })
              )
            }
          >
            Go to Recipes
          </button>
        </div>
      </div>

      {/* Layout: chart + table + AI side */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2fr) minmax(0, 2fr)",
          gap: 16,
        }}
      >
        {/* Chart + summary */}
        <div className="card">
          <h3 className="card-title">
            Popularity vs Profitability (Quadrant)
          </h3>
          <p className="page-subtitle">
            Each point is a menu item. X = popularity
            (approx. units sold), Y = margin %.
          </p>
          <button
            type="button"
            className="secondary-btn"
            style={{ marginBottom: 8 }}
            onClick={handleExplainWithAI}
          >
            Explain this chart with AI
          </button>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="popularity"
                  name="Popularity"
                />
                <YAxis
                  dataKey="marginPct"
                  name="Margin %"
                  tickFormatter={(v) => `${v.toFixed(0)}%`}
                />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  formatter={(value, name, props) => {
                    if (name === "marginPct") {
                      return [
                        value.toFixed(1) + "%",
                        "Margin %",
                      ];
                    }
                    if (name === "popularity") {
                      return [
                        value.toFixed(1),
                        "Popularity",
                      ];
                    }
                    return [value, name];
                  }}
                  labelFormatter={() => ""}
                />
                <Legend />
                {Object.entries(groupedByClass).map(
                  ([cls, data]) => (
                    <Scatter
                      key={cls}
                      name={cls}
                      data={data.map((i) => ({
                        name: i.name,
                        popularity: i.popularity,
                        marginPct: i.marginPct * 100,
                        classification: cls,
                      }))}
                      fill={CLASS_COLORS[cls] || "#94a3b8"}
                      shape="circle"
                    />
                  )
                )}
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          <div style={{ marginTop: 12 }}>
            <h4 className="card-title" style={{ fontSize: 14 }}>
              Classification counts
            </h4>
            <ul
              style={{
                fontSize: 13,
                paddingLeft: 18,
                marginTop: 4,
              }}
            >
              <li>Stars: {classificationSummary.Star}</li>
              <li>
                Plowhorses: {classificationSummary.Plowhorse}
              </li>
              <li>Puzzles: {classificationSummary.Puzzle}</li>
              <li>Dogs: {classificationSummary.Dog}</li>
              <li>
                Unclassified:{" "}
                {classificationSummary.Unclassified}
              </li>
            </ul>
          </div>
        </div>

        {/* Table + AI */}
        <div
          style={{
            display: "grid",
            gridTemplateRows: "minmax(0, 1.6fr) minmax(0, 1fr)",
            gap: 16,
          }}
        >
          <div className="card">
            <h3 className="card-title">
              Item List &amp; Suggested Moves
            </h3>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Brand</th>
                    <th>Outlet</th>
                    <th>Price</th>
                    <th>Cost</th>
                    <th>Popularity</th>
                    <th>Margin %</th>
                    <th>Class</th>
                    <th>Suggested move</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan="9">
                        No menu items found. Make sure Recipes
                        / Menu data is saved.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((i) => (
                      <tr key={i.id}>
                        <td>{i.name}</td>
                        <td>{i.brand}</td>
                        <td>{i.outlet}</td>
                        <td>{i.menuPrice.toFixed(3)}</td>
                        <td>{i.foodCost.toFixed(3)}</td>
                        <td>{i.popularity.toFixed(1)}</td>
                        <td>
                          {(i.marginPct * 100).toFixed(1)}%
                        </td>
                        <td>{i.classification}</td>
                        <td style={{ fontSize: 12 }}>
                          <span
                            style={{
                              backgroundColor:
                                CLASS_COLORS[
                                  i.classification
                                ] || "#e2e8f0",
                              color: "#0f172a",
                              padding: "2px 6px",
                              borderRadius: 6,
                              fontWeight: 600,
                              marginRight: 6,
                            }}
                          >
                            {i.classification}
                          </span>
                          {i.suggestedMove}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">
              AI Menu Insights &amp; Actions
            </h3>
            <p className="page-subtitle">
              Let AI explain the menu engineering results and
              suggest concrete actions.
            </p>

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginBottom: 8,
              }}
            >
              <button
                type="button"
                className="secondary-btn"
                onClick={handleExplainWithAI}
              >
                Explain with AI
              </button>
              <button
                type="button"
                className="primary-btn"
                onClick={handleActionsWithAI}
              >
                Suggest menu actions with AI
              </button>
            </div>

            {aiExplainLoading && (
              <p style={{ fontSize: 12 }}>Explaining...</p>
            )}
          {aiExplainText && (
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                backgroundColor: "#eef2ff",
                padding: 8,
                borderRadius: 6,
              }}
              dangerouslySetInnerHTML={{ __html: marked.parse(aiExplainText) }}
            />
          )}

            {aiActionsLoading && (
              <p style={{ fontSize: 12, marginTop: 8 }}>
                Generating action ideas...
              </p>
            )}
          {aiActionsText && (
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                backgroundColor: "#f1f5f9",
                padding: 8,
                borderRadius: 6,
              }}
              dangerouslySetInnerHTML={{ __html: marked.parse(aiActionsText) }}
            />
          )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MenuEngineeringHub;
