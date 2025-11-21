// src/App.jsx
import { useState } from "react";
import DataEntryHub from "./features/data-entry/DataEntryHub";
import RecipesManager from "./features/recipes/RecipesManager";
import MenuEngineeringHub from "./features/menu-engineering/MenuEngineeringHub";
import ReportsHub from "./features/reports/ReportsHub";
import CashFlowHub from "./features/reports/CashFlowHub";
import TargetsHub from "./features/targets/TargetsHub";
import ScenarioPlanningHub from "./features/scenario-planning/ScenarioPlanningHub";
import BrandingMarketingHub from "./features/branding/BrandingMarketingHub";
import ActionPlanHub from "./features/action-plan/ActionPlanHub";
import AdminHub from "./features/admin/AdminHub";

const NAV_ITEMS = [
  {
    id: "data",
    label: "Data Entry",
    description: "Sales, purchases, waste, inventory, HR, rent, petty cash",
  },
  {
    id: "recipes",
    label: "Recipes & Costing",
    description: "Recipes, sub-recipes, menu item costing",
  },
  {
    id: "menu",
    label: "Menu Engineering",
    description: "Stars / Dogs, popularity vs margin, actions",
  },
  {
    id: "reports",
    label: "Reports & Dashboard",
    description: "KPIs, charts, outlet performance",
  },
  {
    id: "cashflow",
    label: "Cash Flow",
    description: "Historic and forecast cash movements",
  },
  {
    id: "targets",
    label: "Targets / Budgets",
    description: "Plan vs actual by brand/outlet",
  },
  {
    id: "scenario",
    label: "Scenario Planning",
    description: "What-if changes on sales and costs",
  },
  {
    id: "branding",
    label: "Branding & Marketing",
    description: "Campaigns, content, spend vs sales",
  },
  {
    id: "action-plan",
    label: "Action Plan Tracker",
    description: "Track tasks and owners from findings",
  },
  {
    id: "admin",
    label: "Admin & Settings",
    description: "Master data, AI, alerts, housekeeping",
  },
];

function App() {
  const [activeTab, setActiveTab] = useState("data");

  const renderActiveTab = () => {
    switch (activeTab) {
      case "data":
        return <DataEntryHub />;
      case "recipes":
        return <RecipesManager />;
      case "menu":
        return <MenuEngineeringHub />;
      case "reports":
        return <ReportsHub />;
      case "cashflow":
        return <CashFlowHub />;
      case "targets":
        return <TargetsHub />;
      case "scenario":
        return <ScenarioPlanningHub />;
      case "branding":
        return <BrandingMarketingHub />;
      case "action-plan":
        return <ActionPlanHub />;
      case "admin":
        return <AdminHub />;
      default:
        return <DataEntryHub />;
    }
  };

  return (
    <div
      className="app-shell"
      style={{
        display: "flex",
        minHeight: "100vh",
        backgroundColor: "#f3f4f6",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
      }}
    >
      <aside
        className="sidebar"
        style={{
          width: 260,
          borderRight: "1px solid #e5e7eb",
          backgroundColor: "#ffffff",
          padding: 16,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 0.02 }}>
            Project Casual
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
            F&amp;B Ops &amp; Reporting Ecosystem
          </div>
        </div>

        <nav
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            marginTop: 4,
            flex: 1,
          }}
        >
          {NAV_ITEMS.map((item) => {
            const isActive = item.id === activeTab;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={isActive ? "nav-btn active" : "nav-btn"}
                style={{
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "none",
                  backgroundColor: isActive ? "#e0e7ff" : "transparent",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? "#1d4ed8" : "#111827",
                  }}
                >
                  {item.label}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: isActive ? "#1d4ed8" : "#6b7280",
                  }}
                >
                  {item.description}
                </span>
              </button>
            );
          })}
        </nav>

        <div
          style={{
            marginTop: 12,
            fontSize: 11,
            color: "#9ca3af",
          }}
        >
          Data is stored locally in your browser. Export before clearing cache
          or switching machines.
        </div>
      </aside>

      <main
        className="main-content"
        style={{
          flex: 1,
          padding: 20,
          maxWidth: "calc(100vw - 260px)",
          overflowX: "hidden",
        }}
      >
        {renderActiveTab()}
      </main>
    </div>
  );
}

export default App;
