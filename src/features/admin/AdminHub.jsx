// src/features/admin/AdminHub.jsx
import { useState, useEffect } from "react";
import DataImportExport from "./DataImportExport";
import AlertRulesAdmin from "./AlertRulesAdmin";
import LogoUploader from "../../assets/LogoUploader";
import {
  getMasterData,
  saveMasterData,
  DEFAULT_BRANDS,
  DEFAULT_OUTLETS,
  DEFAULT_WASTE_REASONS,
  DEFAULT_PETTY_CASH_CATEGORIES,
  DEFAULT_HR_ROLES,
} from "../../config/lookups";

const ADMIN_TABS = [
  { id: "data", label: "Data Import / Export" },
  { id: "alerts", label: "Alerts & Thresholds" },
  { id: "master", label: "Dropdowns / Master Data" },
  { id: "branding", label: "Branding & Logo" },
];

// --- Subcomponent: Master data (dropdowns) editor ---

function MasterDataAdmin() {
  const [brandText, setBrandText] = useState("");
  const [outletText, setOutletText] = useState("");
  const [wasteReasonText, setWasteReasonText] = useState("");
  const [pettyCategoryText, setPettyCategoryText] = useState("");
  const [hrRoleText, setHrRoleText] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    try {
      const master = getMasterData();
      const brands = master.brands || DEFAULT_BRANDS;
      const outlets = master.outlets || DEFAULT_OUTLETS;
      const wasteReasons =
        master.wasteReasons || DEFAULT_WASTE_REASONS;
      const pettyCategories =
        master.pettyCategories || DEFAULT_PETTY_CASH_CATEGORIES;
      const hrRoles = master.hrRoles || DEFAULT_HR_ROLES;

      setBrandText(brands.join("\n"));
      setOutletText(outlets.join("\n"));
      setWasteReasonText(wasteReasons.join("\n"));
      setPettyCategoryText(pettyCategories.join("\n"));
      setHrRoleText(hrRoles.join("\n"));
    } catch (e) {
      console.error("Failed to load master data in Admin", e);
    }
  }, []);

  const normalizeList = (text, fallback) => {
    const arr = text
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    return arr.length ? arr : fallback;
  };

  const handleSave = () => {
    const brands = normalizeList(brandText, DEFAULT_BRANDS);
    const outlets = normalizeList(outletText, DEFAULT_OUTLETS);
    const wasteReasons = normalizeList(
      wasteReasonText,
      DEFAULT_WASTE_REASONS
    );
    const pettyCategories = normalizeList(
      pettyCategoryText,
      DEFAULT_PETTY_CASH_CATEGORIES
    );
    const hrRoles = normalizeList(hrRoleText, DEFAULT_HR_ROLES);

    saveMasterData({
      brands,
      outlets,
      wasteReasons,
      pettyCategories,
      hrRoles,
    });

    setStatus("Saved. Go to Data Entry → dropdowns will reflect these lists.");
    setTimeout(() => setStatus(""), 3000);
  };

  const handleResetDefaults = () => {
    setBrandText(DEFAULT_BRANDS.join("\n"));
    setOutletText(DEFAULT_OUTLETS.join("\n"));
    setWasteReasonText(DEFAULT_WASTE_REASONS.join("\n"));
    setPettyCategoryText(DEFAULT_PETTY_CASH_CATEGORIES.join("\n"));
    setHrRoleText(DEFAULT_HR_ROLES.join("\n"));
    setStatus("Defaults restored. Click Save to apply.");
    setTimeout(() => setStatus(""), 3000);
  };

  return (
    <div className="card">
      <h3 className="card-title">Dropdowns / Master Data</h3>
      <p className="page-subtitle">
        Edit the lists used in all dropdown menus across Data Entry (brand,
        outlet, waste reason, HR roles, petty cash categories). One value per
        line.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginTop: 8,
        }}
      >
        <div>
          <label className="field-label">Brands</label>
          <textarea
            rows={8}
            value={brandText}
            onChange={(e) => setBrandText(e.target.value)}
            style={{ width: "100%" }}
          />
          <small>Example: Buns Meat Dough, Fish Face… (one per line)</small>
        </div>

        <div>
          <label className="field-label">Outlets</label>
          <textarea
            rows={8}
            value={outletText}
            onChange={(e) => setOutletText(e.target.value)}
            style={{ width: "100%" }}
          />
          <small>Example: Abdoun Dine-in, Cloud Kitchen…</small>
        </div>

        <div>
          <label className="field-label">Waste Reasons</label>
          <textarea
            rows={8}
            value={wasteReasonText}
            onChange={(e) => setWasteReasonText(e.target.value)}
            style={{ width: "100%" }}
          />
          <small>Example: Spoilage, Overproduction, Staff Meal…</small>
        </div>

        <div>
          <label className="field-label">Petty Cash Categories</label>
          <textarea
            rows={8}
            value={pettyCategoryText}
            onChange={(e) => setPettyCategoryText(e.target.value)}
            style={{ width: "100%" }}
          />
          <small>Example: Delivery tips, Cleaning supplies…</small>
        </div>

        <div>
          <label className="field-label">HR Roles</label>
          <textarea
            rows={8}
            value={hrRoleText}
            onChange={(e) => setHrRoleText(e.target.value)}
            style={{ width: "100%" }}
          />
          <small>Example: Kitchen, Service, Delivery…</small>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button
          type="button"
          className="primary-btn"
          onClick={handleSave}
        >
          Save Dropdowns
        </button>
        <button
          type="button"
          className="secondary-btn"
          onClick={handleResetDefaults}
        >
          Restore Defaults (not saved yet)
        </button>
      </div>

      {status && (
        <p style={{ marginTop: 8, fontSize: 13, color: "#2563eb" }}>
          {status}
        </p>
      )}
    </div>
  );
}

// --- Main Admin Hub ---

function AdminHub() {
  const [activeTab, setActiveTab] = useState("data");

  return (
    <div>
      <h2 className="page-title">Admin & Settings</h2>
      <p className="page-subtitle">
        Configure alerts, import/export data, and control global dropdown
        values for all brands/outlets.
      </p>

      <div
        className="section-tabs"
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        {ADMIN_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              border: "1px solid #e5e7eb",
              backgroundColor:
                activeTab === tab.id ? "#e0f2fe" : "#ffffff",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "data" && <DataImportExport />}
      {activeTab === "alerts" && <AlertRulesAdmin />}
      {activeTab === "master" && <MasterDataAdmin />}
      {activeTab === "branding" && <LogoUploader />}
    </div>
  );
}

export default AdminHub;
