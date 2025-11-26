// src/App.jsx
import { useState, useEffect, useMemo } from "react";
import "./App.css";

import DataEntryHub from "./features/data-entry/DataEntryHub";
import ReportsHub from "./features/reports/ReportsHub";
import ReportsCenter from "./features/reports/ReportsCenter"; // NEW: Reports Center
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
import HrHub from "./features/hr/HrHub";
import ExecutiveDashboard from "./features/dashboard/ExecutiveDashboard";

import { useData } from "./DataContext";
import { APP_USERS } from "./authConfig";

// Navigation map with role access
const NAV_ITEMS = [
  { id: "dashboard", label: "Executive Dashboard", roles: ["admin", "manager", "viewer"] },
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
  { id: "hr", label: "HR & Staffing", roles: ["admin", "manager"] },
  { id: "admin", label: "Admin & Settings", roles: ["admin"] },
];

function App() {
  const {
    logo,
    brandFilter,
    setBrandFilter,
    outletFilter,
    setOutletFilter,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
  } = useData();
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState("data-entry");
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [navSearch, setNavSearch] = useState("");
  const [showHelp, setShowHelp] = useState(false);

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

  // Allow other components to request navigation (e.g., quick links)
  useEffect(() => {
    const handler = (e) => {
      const targetTab = e.detail;
      if (targetTab) setActiveTab(targetTab);
    };
    window.addEventListener("pc:navigate", handler);
    return () => window.removeEventListener("pc:navigate", handler);
  }, []);

  // Keyboard shortcuts for nav and search
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        document.querySelector(".nav-search")?.focus();
        return;
      }
      if (e.ctrlKey || e.metaKey) return;
      if (e.key === "g") {
        // wait for next key
        const listener = (evt) => {
          const k = evt.key.toLowerCase();
          if (k === "r") setActiveTab("reports");
          if (k === "m") setActiveTab("menu");
          if (k === "a") setActiveTab("action-plan");
          if (k === "h") setActiveTab("hr");
          window.removeEventListener("keydown", listener, true);
        };
        window.addEventListener("keydown", listener, true);
      }
      if (e.key === "?") {
        e.preventDefault();
        setShowHelp(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Compute brand/outlet options from stored datasets (hooks must stay before any return)
  const { navBrandOptions, navOutletOptions } = useMemo(() => {
    const keys = [
      "pc_sales",
      "pc_purchases",
      "pc_waste",
      "pc_rent_opex",
      "pc_hr_labor",
      "pc_petty_cash",
      "pc_menu_items",
      "pc_recipes",
    ];
    const brands = new Set();
    const outlets = new Set();
    keys.forEach((k) => {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return;
        parsed.forEach((row) => {
          if (row.brand) brands.add(String(row.brand));
          if (row.outlet) outlets.add(String(row.outlet));
        });
      } catch {
        // ignore malformed data
      }
    });
    return {
      navBrandOptions: ["", ...Array.from(brands).sort()],
      navOutletOptions: ["", ...Array.from(outlets).sort()],
    };
  }, []);

  // If not logged in, show login screen
  if (!currentUser) {
    return (
      <div className="login-wrapper">
        <div className="login-card">
          {logo && (
            <img
              src={logo}
              alt="App Logo"
              style={{ maxWidth: '150px', height: 'auto', marginBottom: '1rem' }}
            />
          )}
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

  const filteredNavItems = visibleNavItems.filter((item) =>
    item.label.toLowerCase().includes(navSearch.trim().toLowerCase())
  );

  const handleNavSearchEnter = (e) => {
    if (e.key === "Enter") {
      const first = filteredNavItems[0];
      if (first) setActiveTab(first.id);
    }
  };

  return (
    <div className="app-shell">
      {/* Header with logo and user info */}
      <header className="app-header">
        <div className="app-brand">
          <div className="logo-wrapper">
            <img
              src={logo || "/logo.png"}
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

      {/* Quick navigation bar */}
      <div className="top-quickbar">
        <div className="quickbar-left">
          <input
            type="search"
            placeholder="Search & jump to a section..."
            className="nav-search"
            value={navSearch}
            onChange={(e) => setNavSearch(e.target.value)}
            onKeyDown={handleNavSearchEnter}
          />
          <div className="quick-pills">
            {["dashboard", "reports", "menu", "recipes", "action-plan"].map((id) => {
              const nav = visibleNavItems.find((n) => n.id === id);
              if (!nav) return null;
              return (
                <button
                  key={id}
                  type="button"
                  className={
                    activeTab === id ? "pill-btn active" : "pill-btn"
                  }
                  onClick={() => setActiveTab(id)}
                >
                  {nav.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="quickbar-right">
          <span className="hint-text">Tip: type and press Enter to jump</span>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => setShowHelp(true)}
          >
            Help / Glossary
          </button>
        </div>
      </div>

      {/* Global filter bar */}
      <div className="global-filter-bar">
        <div className="filter-group">
          <label>Brand</label>
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
          >
            <option value="">All brands</option>
            {navBrandOptions.map(
              (b) =>
                b && (
                  <option key={b} value={b}>
                    {b}
                  </option>
                )
            )}
          </select>
        </div>
        <div className="filter-group">
          <label>Outlet</label>
          <select
            value={outletFilter}
            onChange={(e) => setOutletFilter(e.target.value)}
          >
            <option value="">All outlets</option>
            {navOutletOptions.map(
              (o) =>
                o && (
                  <option key={o} value={o}>
                    {o}
                  </option>
                )
            )}
          </select>
        </div>
        <div className="filter-group">
          <label>Start date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label>End date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div className="filter-actions">
          <button
            type="button"
            className="secondary-btn"
            onClick={() => {
              setBrandFilter("");
              setOutletFilter("");
              setStartDate("");
              setEndDate("");
            }}
          >
            Reset filters
          </button>
          <span className="hint-text">Filters apply across all sections</span>
        </div>
      </div>

      {/* Main layout: left nav + right content */}
      <div className="app-main">
        <aside className="app-sidebar">
          {filteredNavItems.map((item) => (
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
          {activeTab === "dashboard" && <ExecutiveDashboard />}

          {activeTab === "data-entry" &&
            (role === "admin" || role === "manager") && <DataEntryHub />}

        {activeTab === "reports" && <ReportsCenter />} {/* NEW: Reports Center */}

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

          {activeTab === "hr" &&
            (role === "admin" || role === "manager") && <HrHub />}

          {activeTab === "action-plan" && <ActionPlanHub />}

          {activeTab === "admin" && role === "admin" && <AdminHub />}
        </main>
      </div>

      {showHelp && (
        <div className="help-overlay" onClick={() => setShowHelp(false)}>
          <div
            className="help-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="help-header">
              <h3>Help & Glossary (F&B)</h3>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setShowHelp(false)}
              >
                Close
              </button>
            </div>
            <div className="help-body">
              <h4>Key terms</h4>
              <ul>
                <li><strong>EBITDA</strong>: Earnings before interest, tax, depreciation, amortization.</li>
                <li><strong>Food %</strong>: Food cost / Sales.</li>
                <li><strong>Labor %</strong>: Labor cost / Sales.</li>
                <li><strong>Star/Plowhorse/Puzzle/Dog</strong>: Menu engineering quadrants (high/low margin vs popularity).</li>
              </ul>
              <h4>Data upload guidance</h4>
              <ul>
                <li>Data Entry Hub: upload Sales, Purchases, Waste, HR/Labor, Rent/Opex, Petty Cash.</li>
                <li>Recipes & Costing: define menu items and costs (feeds Menu Engineering automatically).</li>
                <li>Reports & AI: use filters (brand/outlet/date) to scope all dashboards and AI outputs.</li>
              </ul>
              <h4>Quick navigation tips</h4>
              <ul>
                <li>Use the top search to jump to a module (Enter to select first match).</li>
                <li>Brand/Outlet/Date filters apply globally across modules.</li>
                <li>Export AI reports as PDF/MD or copy text from the Reports page.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
