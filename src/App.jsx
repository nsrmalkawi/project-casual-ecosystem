// src/App.jsx
import { useState, useEffect } from "react";
import "./App.css";

import DataEntryHub from "./features/data-entry/DataEntryHub";
import ReportsHub from "./features/reports/ReportsHub";
import CashFlowHub from "./features/reports/CashFlowHub";
import MenuEngineeringHub from "./features/menu-engineering/MenuEngineeringHub";
import RecipesManager from "./features/recipes/RecipesManager";
import TargetsHub from "./features/targets/TargetsHub";
import ScenarioPlanningHub from "./features/scenario-planning/ScenarioPlanningHub";
import SupplierPerformanceHub from "./features/suppliers/SupplierPerformanceHub";
import ReconciliationHub from "./features/reconciliation/ReconciliationHub";
import BrandingMarketingHub from "./features/branding/BrandingMarketingHub";
import ActionPlanHub from "./features/action-plan/ActionPlanHub";
import AdminHub from "./features/admin/AdminHub";

import { APP_USERS } from "./authConfig";

// Navigation map with role access
const NAV_ITEMS = [
  { id: "data-entry", label: "Data Entry Hub", roles: ["admin", "manager"] },
  { id: "reports", label: "Reports & KPIs", roles: ["admin", "manager", "viewer"] },
  { id: "cash-flow", label: "Cash Flow", roles: ["admin", "manager", "viewer"] },
  { id: "menu", label: "Menu Engineering", roles: ["admin", "manager", "viewer"] },
  { id: "recipes", label: "Recipes & Costing", roles: ["admin", "manager", "viewer"] },
  { id: "targets", label: "Targets / Budgets", roles: ["admin", "manager"] },
  { id: "scenario", label: "Scenario Planning", roles: ["admin", "manager"] },
  { id: "suppliers", label: "Suppliers & Purchases", roles: ["admin", "manager"] },
  { id: "reconciliation", label: "Waste & Inventory Reconciliation", roles: ["admin", "manager"] },
  { id: "branding", label: "Branding & Marketing", roles: ["admin", "manager"] },
  { id: "action-plan", label: "Action Plan Tracker", roles: ["admin", "manager", "viewer"] },
  { id: "admin", label: "Admin & Settings", roles: ["admin"] },
];

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState("data-entry");
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");

  // Restore last logged-in user if present
  useEffect(() => {
    try {
      const raw = localStorage.getItem("pc_current_user_v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.username && parsed.role) {
          setCurrentUser(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to restore user session", e);
    }
  }, []);

  // Persist current user to localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem("pc_current_user_v1", JSON.stringify(currentUser));
    } else {
      localStorage.removeItem("pc_current_user_v1");
    }
  }, [currentUser]);

  const handleLogin = (e) => {
    e.preventDefault();
    setLoginError("");

    const { username, password } = loginForm;
    const user = APP_USERS.find(
      (u) => u.username === username && u.password === password
    );

    if (!user) {
      setLoginError("Invalid username or password");
      return;
    }

    setCurrentUser({ username: user.username, role: user.role });
    setActiveTab("data-entry");
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab("data-entry");
    setLoginForm({ username: "", password: "" });
    setLoginError("");
  };

  // If not logged in, show login screen
  if (!currentUser) {
    return (
      <div className="login-wrapper">
        <div className="login-card">
          <h1>Project Casual Ecosystem</h1>
          <p className="page-subtitle">
            Sign in to access your F&amp;B performance cockpit.
          </p>

          <form onSubmit={handleLogin} className="login-form">
            <label>
              Username
              <input
                type="text"
                value={loginForm.username}
                onChange={(e) =>
                  setLoginForm((f) => ({ ...f, username: e.target.value }))
                }
                autoComplete="username"
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) =>
                  setLoginForm((f) => ({ ...f, password: e.target.value }))
                }
                autoComplete="current-password"
              />
            </label>

            {loginError && <div className="error-text">{loginError}</div>}

            <button
              type="submit"
              className="primary-btn"
              style={{ marginTop: 12 }}
            >
              Sign in
            </button>

            <div className="helper-text">
              admin / AdminStrong123! · manager / Manager123! · viewer /
              Viewer123!
            </div>
          </form>
        </div>
      </div>
    );
  }

  const role = currentUser.role;

  const visibleNavItems = NAV_ITEMS.filter((item) =>
    item.roles.includes(role)
  );

  return (
    <div className="app-shell">
      {/* Header with logo and user info */}
      <header className="app-header">
        <div className="app-brand">
          <div className="logo-wrapper">
            {/* Place logo.png in /public; this will not break if missing */}
            <img
              src="/logo.png"
              alt="Project Casual"
              className="app-logo"
            />
          </div>
          <div className="brand-text">
            <h1>Project Casual Ecosystem</h1>
            <p>Multi-brand F&amp;B performance &amp; action hub</p>
          </div>
        </div>

        <div className="app-header-right">
          <div className="user-pill">
            <span className="user-name">{currentUser.username}</span>
            <span className="user-role">{role}</span>
          </div>
          <button
            type="button"
            className="secondary-btn"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main layout: left nav + right content */}
      <div className="app-main">
        <aside className="app-sidebar">
          {visibleNavItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={
                activeTab === item.id ? "nav-btn active" : "nav-btn"
              }
              onClick={() => setActiveTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </aside>

        <main className="app-content">
          {/* Tab routing with role checks */}
          {activeTab === "data-entry" &&
            (role === "admin" || role === "manager") && <DataEntryHub />}

          {activeTab === "reports" && <ReportsHub />}

          {activeTab === "cash-flow" && <CashFlowHub />}

          {activeTab === "menu" && <MenuEngineeringHub />}

          {activeTab === "recipes" && <RecipesManager />}

          {activeTab === "targets" &&
            (role === "admin" || role === "manager") && <TargetsHub />}

          {activeTab === "scenario" &&
            (role === "admin" || role === "manager") && (
              <ScenarioPlanningHub />
            )}

          {activeTab === "suppliers" &&
            (role === "admin" || role === "manager") && (
              <SupplierPerformanceHub />
            )}

          {activeTab === "reconciliation" &&
            (role === "admin" || role === "manager") && (
              <ReconciliationHub />
            )}

          {activeTab === "branding" &&
            (role === "admin" || role === "manager") && (
              <BrandingMarketingHub />
            )}

          {activeTab === "action-plan" && <ActionPlanHub />}

          {activeTab === "admin" && role === "admin" && <AdminHub />}
        </main>
      </div>
    </div>
  );
}

export default App;
