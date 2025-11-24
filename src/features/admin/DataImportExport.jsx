// src/features/admin/DataImportExport.jsx
import { useState } from "react";

/**
 * Collect all localStorage keys starting with "pc_" into one object.
 */
function collectLocalSnapshot() {
  const snapshot = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (!key.startsWith("pc_")) continue;

    try {
      const raw = localStorage.getItem(key);
      snapshot[key] = raw ? JSON.parse(raw) : null;
    } catch {
      snapshot[key] = null;
    }
  }
  return snapshot;
}

/**
 * Apply a snapshot (map of key -> value) into localStorage.
 */
function applyLocalSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return;
  Object.entries(snapshot).forEach(([key, value]) => {
    if (!key.startsWith("pc_")) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error("Failed to set localStorage key", key, e);
    }
  });
}

export default function DataImportExport() {
  const [status, setStatus] = useState("");
  const API_BASE = import.meta.env.VITE_API_BASE || "";

  const apiUrl = (path) =>
    API_BASE ? `${API_BASE}${path}`.replace(/([^:]\/)\/+/g, "$1") : path;

  const TABLES = [
    { id: "sales", label: "Sales" },
    { id: "purchases", label: "Purchases" },
    { id: "waste", label: "Waste" },
    { id: "recipe_waste", label: "Recipe Waste" },
    { id: "inventory_items", label: "Inventory Items" },
    { id: "rent_opex", label: "Rent / Opex" },
    { id: "hr_payroll", label: "HR / Payroll" },
    { id: "petty_cash", label: "Petty Cash" },
  ];

  // ---- Local JSON export/import ----

  const handleExportLocal = () => {
    const snapshot = collectLocalSnapshot();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `project-casual-backup-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportLocal = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        applyLocalSnapshot(data);
        setStatus("Local import successful.");
      } catch (err) {
        console.error("Import error", err);
        setStatus("Failed to import local JSON.");
      }
    };
    reader.readAsText(file);
  };

  // ---- Cloud DB backup/restore ----

  const handleSaveToCloud = async () => {
    try {
      setStatus("Saving snapshot to Cloud DB...");
      const snapshot = collectLocalSnapshot();

      const resp = await fetch("/api/cloud-save-snapshot", {
      const resp = await fetch(apiUrl("/api/cloud-save-snapshot"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Cloud save failed: ${resp.status} ${text}`);
      }

      setStatus("Cloud snapshot saved successfully.");
    } catch (err) {
      console.error("Cloud save error", err);
      setStatus("Cloud save failed. Check console and server logs.");
    }
  };

  const handleLoadFromCloud = async () => {
    try {
      setStatus("Loading snapshot from Cloud DB...");
      const resp = await fetch("/api/cloud-load-snapshot");
      const resp = await fetch(apiUrl("/api/cloud-load-snapshot"));
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Cloud load failed: ${resp.status} ${text}`);
      }

      const data = await resp.json();
      if (!data.snapshot) {
        setStatus("No cloud snapshot found yet.");
        return;
      }

      applyLocalSnapshot(data.snapshot);
      setStatus("Cloud snapshot loaded into localStorage.");
    } catch (err) {
      console.error("Cloud load error", err);
      setStatus("Cloud load failed. Check console and server logs.");
    }
  };

  // ---- Direct exports from Cloud DB ----

  const triggerDownload = async (url, filename) => {
    try {
      setStatus("Preparing download...");
      const resp = await fetch(apiUrl(url));
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Download failed: ${resp.status} ${text}`);
      }
      const blob = await resp.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(objUrl);
      setStatus("Download started.");
    } catch (err) {
      console.error("Download error", err);
      setStatus("Export failed. Check server logs and DATABASE_URL.");
    }
  };

  return (
    <div className="card">
      <h3 className="card-title">Data Import &amp; Export</h3>
      <p className="page-subtitle">
        Backup or restore all <code>pc_*</code> data either to a local JSON
        file or to the Cloud DB.
      </p>

      {/* Local JSON backup */}
      <div style={{ marginBottom: 16 }}>
        <h4>Local JSON Backup</h4>
        <button
          type="button"
          className="primary-btn"
          style={{ marginRight: 8, marginTop: 4 }}
          onClick={handleExportLocal}
        >
          Export local data to JSON
        </button>

        <label
          style={{
            display: "inline-block",
            marginTop: 8,
            padding: "6px 12px",
            borderRadius: 4,
            border: "1px solid #d4d4d4",
            cursor: "pointer",
          }}
        >
          Import from JSON file
          <input
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={handleImportLocal}
          />
        </label>
      </div>

      <hr style={{ margin: "16px 0" }} />

      {/* Cloud DB backup */}
      <div>
        <h4>Cloud DB Backup</h4>
        <p style={{ fontSize: 13, marginBottom: 8 }}>
          Uses the <code>pc_snapshots</code> table in your PostgreSQL database
          via <code>/api/cloud-save-snapshot</code> and{" "}
          <code>/api/cloud-load-snapshot</code>.
        </p>
        <button
          type="button"
          className="primary-btn"
          style={{ marginRight: 8, marginTop: 4 }}
          onClick={handleSaveToCloud}
        >
          Save current data to Cloud DB
        </button>
        <button
          type="button"
          className="secondary-btn"
          style={{ marginTop: 4 }}
          onClick={handleLoadFromCloud}
        >
          Load latest snapshot from Cloud DB
        </button>
      </div>

      <hr style={{ margin: "16px 0" }} />

      {/* Direct exports from PostgreSQL */}
      <div>
        <h4>Export tables (CSV / Excel)</h4>
        <p style={{ fontSize: 13, marginBottom: 8 }}>
          Requires <code>DATABASE_URL</code> set on the server. Downloads from
          tables: sales, purchases, waste, recipe_waste, inventory_items,
          rent_opex, hr_payroll, petty_cash.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 8,
          }}
        >
          {TABLES.map((t) => (
            <div key={t.id} className="card" style={{ padding: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{t.label}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() =>
                    triggerDownload(`/api/export/${t.id}`, `${t.id}.csv`)
                  }
                >
                  Download CSV
                </button>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() =>
                    triggerDownload(`/api/export-xlsx/${t.id}`, `${t.id}.xlsx`)
                  }
                >
                  Download Excel
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {status && (
        <p style={{ marginTop: 12, fontSize: 13, color: "#4b5563" }}>
          {status}
        </p>
      )}
    </div>
  );
}
