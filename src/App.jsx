// src/App.jsx
import { useEffect, useState } from "react";
import "./App.css";
import DataEntryHub from "./features/data-entry/DataEntryHub";
import ReportsHub from "./features/reports/ReportsHub";
import RecipesManager from "./features/recipes/RecipesManager";
import MenuEngineeringHub from "./features/menu-engineering/MenuEngineeringHub";
import ScenarioPlanningHub from "./features/scenario-planning/ScenarioPlanningHub";
import TargetsHub from "./features/targets/TargetsHub";
import SupplierPerformanceHub from "./features/suppliers/SupplierPerformanceHub";
import ReconciliationHub from "./features/reconciliation/ReconciliationHub";
import BrandingMarketingHub from "./features/branding/BrandingMarketingHub";
import ActionPlanHub from "./features/action-plan/ActionPlanHub";
import CashFlowHub from "./features/reports/CashFlowHub";
import AdminHub from "./features/admin/AdminHub";

const ACCESS_KEY = "pc_ecosystem_access_v1";

function LoginScreen({ onLogin }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    const expected = import.meta.env.VITE_APP_ACCESS_PASSWORD;

    // If no password is set in env, just allow access
    if (!expected) {
      onLogin();
      return;
    }

    if (password === expected) {
      localStorage.setItem(ACCESS_KEY, "true");
      setError("");
      onLogin();
    } else {
      setError("Incorrect password. Please try again.");
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <h1 className="login-title">Project Casual Ecosystem</h1>
        <p className="login-subtitle">
          Enter the access password to open the dashboard.
        </p>
        <form onSubmit={handleSubmit} className="login-form">
          <input
            type="password"
            placeholder="Access password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="login-input"
          />
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="primary-btn" style={{ width: "100%", marginTop: 12 }}>
            Unlock
          </button>
        </form>
        <p className="login-helper">
          This is a private internal tool for the Project Casual group.
        </p>
      </div>
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState("data");
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(ACCESS_KEY) === "true") {
      setAuthenticated(true);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem(ACCESS_KEY);
    setAuthenticated(false);
  };

  if (!authenticated) {
    return <LoginScreen onLogin={() => setAuthenticated(true)} />;
  }

  const renderActiveTab = () => {
    switch (activeTab) {
      case "data":
        return <DataEntryHub />;
      case "recipes":
        return <RecipesManager />;
      case "reports":
        return <ReportsHub />;
      case "cashflow":
        return <CashFlowHub />;
      case "menu":
        return <MenuEngineeringHub />;
      case "scenario":
        return <ScenarioPlanningHub />;
      case "targets":
        return <TargetsHub />;
      case "suppliers":
        return <SupplierPerformanceHub />;
      case "reconciliation":
        return <ReconciliationHub />;
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
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="app-title">PC Ecosystem</h1>
          <p className="app-subtitle">Ops · Finance · AI</p>
        </div>

        <nav className="nav-section">
          <p className="nav-label">Core</p>
          <button
            type="button"
            className={activeTab === "data" ? "nav-btn active" : "nav-btn"}
            onClick={() => setActiveTab("data")}
          >
            Data Entry Hub
          </button>
          <button
            type="button"
            className={activeTab === "recipes" ? "nav-btn active" : "nav-btn"}
            onClick={() => setActiveTab("recipes")}
          >
            Recipes & Costing
          </button>
          <button
            type="button"
            className={activeTab === "reports" ? "nav-btn active" : "nav-btn"}
            onClick={() => setActiveTab("reports")}
          >
            Reports & Dashboard
          </button>
          <button
            type="button"
            className={activeTab === "cashflow" ? "nav-btn active" : "nav-btn"}
            onClick={() => setActiveTab("cashflow")}
          >
            Cash Flow
          </button>

          <p className="nav-label">Strategy</p>
          <button
            type="button"
            className={activeTab === "menu" ? "nav-btn active" : "nav-btn"}
            onClick={() => setActiveTab("menu")}
          >
            Menu Engineering
          </button>
          <button
            type="button"
            className={activeTab === "scenario" ? "nav-btn active" : "nav-btn"}
            onClick={() => setActiveTab("scenario")}
          >
            Scenario Planning
          </button>
          <button
            type="button"
            className={activeTab === "targets" ? "nav-btn active" : "nav-btn"}
            onClick={() => setActiveTab("targets")}
          >
            Targets / Budgets
          </button>
          <button
            type="button"
            className={
              activeTab === "reconciliation" ? "nav-btn active" : "nav-btn"
            }
            onClick={() => setActiveTab("reconciliation")}
          >
            Waste & Inventory Reconciliation
          </button>

          <p className="nav-label">Growth</p>
          <button
            type="button"
            className={activeTab === "suppliers" ? "nav-btn active" : "nav-btn"}
            onClick={() => setActiveTab("suppliers")}
          >
            Supplier Performance
          </button>
          <button
            type="button"
            className={activeTab === "branding" ? "nav-btn active" : "nav-btn"}
            onClick={() => setActiveTab("branding")}
          >
            Branding & Marketing
          </button>
          <button
            type="button"
            className={
              activeTab === "action-plan" ? "nav-btn active" : "nav-btn"
            }
            onClick={() => setActiveTab("action-plan")}
          >
            Action Plan
          </button>

          <p className="nav-label">System</p>
          <button
            type="button"
            className={activeTab === "admin" ? "nav-btn active" : "nav-btn"}
            onClick={() => setActiveTab("admin")}
          >
            Admin / Settings
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="nav-btn subtle" type="button" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </aside>

      <main className="main-panel">{renderActiveTab()}</main>
    </div>
  );
}

export default App;
