// src/features/admin/DataImportExport.jsx
import { useState } from "react";

const STORAGE_KEYS = [
  { key: "pc_sales", label: "Sales" },
  { key: "pc_purchases", label: "Purchases / COGS" },
  { key: "pc_waste", label: "Waste" },
  { key: "pc_inventory", label: "Inventory / Items Master" },
  { key: "pc_rent_opex", label: "Rent & Opex" },
  { key: "pc_hr_labor", label: "HR / Labor" },
  { key: "pc_petty_cash", label: "Petty Cash" },
  { key: "pc_recipes", label: "Recipes & Sub-recipes" },
  { key: "pc_menu_engineering", label: "Menu Engineering" },
  { key: "pc_targets", label: "Targets / Budgets" },
  { key: "pc_scenarios", label: "Scenario Planning" },
  { key: "pc_branding", label: "Branding & Marketing" },
  { key: "pc_action_plan", label: "Action Plan" },
];

function timestampName() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    "-" +
    pad(d.getHours()) +
    pad(d.getMinutes())
  );
}

function DataImportExport() {
  const [selectedKeys, setSelectedKeys] = useState(
    () => new Set(STORAGE_KEYS.map((k) => k.key)) // all selected by default
  );
  const [importStatus, setImportStatus] = useState("");
  const [exportStatus, setExportStatus] = useState("");
  const [lastImportedSummary, setLastImportedSummary] = useState(null);

  const toggleKey = (key) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedKeys(new Set(STORAGE_KEYS.map((k) => k.key)));
  };

  const handleClearAll = () => {
    setSelectedKeys(new Set());
  };

  const handleExport = () => {
    try {
      const payload = {};
      let count = 0;

      STORAGE_KEYS.forEach(({ key }) => {
        if (!selectedKeys.has(key)) return;
        const raw = localStorage.getItem(key);
        if (raw != null) {
          try {
            payload[key] = JSON.parse(raw);
          } catch {
            // if not valid JSON, store raw string
            payload[key] = raw;
          }
          count += 1;
        }
      });

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `project-casual-data-${timestampName()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportStatus(
        count === 0
          ? "No data found for selected keys. Exported empty JSON."
          : `Exported ${count} collections to JSON file.`
      );
    } catch (err) {
      console.error("Export error:", err);
      setExportStatus("Export failed: " + err.message);
    }
  };

  const handleImportFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    setImportStatus("Reading file...");
    setLastImportedSummary(null);

    try {
      const text = await file.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        throw new Error("File is not valid JSON.");
      }

      if (typeof parsed !== "object" || parsed === null) {
        throw new Error("JSON must be an object of key → value.");
      }

      const knownKeys = new Set(STORAGE_KEYS.map((k) => k.key));
      const summary = [];
      let applied = 0;
      let skipped = 0;

      Object.entries(parsed).forEach(([key, value]) => {
        if (!knownKeys.has(key)) {
          skipped += 1;
          summary.push({
            key,
            action: "skipped (unknown key)",
          });
          return;
        }
        try {
          localStorage.setItem(key, JSON.stringify(value ?? null));
          applied += 1;
          const size =
            Array.isArray(value) || typeof value === "object"
              ? Array.isArray(value)
                ? value.length + " rows"
                : "object"
              : "value";
          summary.push({
            key,
            action: "imported",
            size,
          });
        } catch (err) {
          skipped += 1;
          summary.push({
            key,
            action: "error: " + err.message,
          });
        }
      });

      setLastImportedSummary({ applied, skipped, details: summary });
      setImportStatus(
        `Import finished. Applied ${applied} keys, skipped ${skipped}.`
      );
    } catch (err) {
      console.error("Import error:", err);
      setImportStatus("Import failed: " + err.message);
    } finally {
      // reset file input so same file can be selected again if needed
      e.target.value = "";
    }
  };

  return (
    <div className="card">
      <h3 className="card-title">Data Import / Export</h3>
      <p className="page-subtitle">
        Backup or restore your ecosystem (localStorage). Use JSON files to move
        data between machines or create snapshots before major changes.
      </p>

      {/* Key selection */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: 8,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 500 }}>
            Collections to include:
          </span>
          <button
            type="button"
            className="secondary-btn"
            onClick={handleSelectAll}
          >
            Select all
          </button>
          <button
            type="button"
            className="secondary-btn"
            onClick={handleClearAll}
          >
            Clear all
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 4,
          }}
        >
          {STORAGE_KEYS.map(({ key, label }) => (
            <label
              key={key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
              }}
            >
              <input
                type="checkbox"
                checked={selectedKeys.has(key)}
                onChange={() => toggleKey(key)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Export section */}
      <div
        style={{
          marginBottom: 12,
          paddingBottom: 12,
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <h4
          style={{
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 4,
          }}
        >
          Export data
        </h4>
        <p className="page-subtitle">
          Downloads a JSON file containing the selected collections.
        </p>
        <button
          type="button"
          className="primary-btn"
          onClick={handleExport}
          style={{ marginTop: 4 }}
        >
          Export selected to JSON
        </button>
        {exportStatus && (
          <p
            style={{
              fontSize: 12,
              marginTop: 6,
              color: "#4b5563",
            }}
          >
            {exportStatus}
          </p>
        )}
      </div>

      {/* Import section */}
      <div>
        <h4
          style={{
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 4,
          }}
        >
          Import data
        </h4>
        <p className="page-subtitle">
          Choose a JSON file previously exported from this tool. Matching keys
          will overwrite current data in localStorage.
        </p>
        <input
          type="file"
          accept="application/json"
          onChange={handleImportFileChange}
          style={{ marginTop: 4 }}
        />
        {importStatus && (
          <p
            style={{
              fontSize: 12,
              marginTop: 6,
              color: importStatus.startsWith("Import failed")
                ? "#b91c1c"
                : "#4b5563",
            }}
          >
            {importStatus}
          </p>
        )}

        {lastImportedSummary && (
          <div
            style={{
              marginTop: 8,
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: 8,
              maxHeight: 220,
              overflowY: "auto",
              backgroundColor: "#f9fafb",
            }}
          >
            <div
              style={{
                fontSize: 12,
                marginBottom: 4,
                fontWeight: 600,
              }}
            >
              Import summary
            </div>
            <ul style={{ paddingLeft: 18, margin: 0, fontSize: 12 }}>
              {lastImportedSummary.details.map((d, idx) => (
                <li key={idx}>
                  <strong>{d.key}</strong>: {d.action}
                  {d.size ? ` (${d.size})` : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default DataImportExport;
