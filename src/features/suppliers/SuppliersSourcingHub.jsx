// src/features/suppliers/SuppliersSourcingHub.jsx
import { useEffect, useMemo, useState } from "react";
import SupplierPerformanceHub from "./SupplierPerformanceHub";
import { exportToCsv } from "../../utils/csv";
import { useData } from "../../DataContext";

const API_BASE =
  import.meta.env.VITE_API_BASE || (typeof window !== "undefined" ? window.location.origin : "");
const apiUrl = (path) =>
  API_BASE ? `${API_BASE}${path}`.replace(/([^:]\/)\/+/g, "$1") : path;

const comparisonFields = [
  { key: "category", label: "Category" },
  { key: "brand", label: "Brand" },
  { key: "menuSection", label: "Menu Section" },
  { key: "item", label: "Item" },
  { key: "specNotes", label: "Spec / Notes" },
  { key: "recommendedSupplier", label: "Recommended Supplier (Cost-efficient)" },
  { key: "alternativeSupplier1", label: "Alternative Supplier 1" },
  { key: "alternativeSupplier2", label: "Alternative Supplier 2" },
  { key: "packSize", label: "Pack Size" },
  { key: "uom", label: "UOM" },
  { key: "priceSupplier1", label: "Price - Supplier 1 (JOD)" },
  { key: "priceSupplier2", label: "Price - Supplier 2 (JOD)" },
  { key: "priceSupplier3", label: "Price - Supplier 3 (JOD)" },
  { key: "lowestPrice", label: "Lowest Price (JOD)" },
  { key: "chosenSupplier", label: "Chosen Supplier" },
  { key: "notes", label: "Notes" },
];

const blankComparison = {
  category: "",
  brand: "",
  menuSection: "",
  item: "",
  specNotes: "",
  recommendedSupplier: "",
  alternativeSupplier1: "",
  alternativeSupplier2: "",
  packSize: "",
  uom: "",
  priceSupplier1: "",
  priceSupplier2: "",
  priceSupplier3: "",
  lowestPrice: "",
  chosenSupplier: "",
  notes: "",
};

const blankDirectory = {
  supplierName: "",
  mainCategories: "",
  type: "",
  notesStrategy: "",
  website: "",
};

const blankContact = {
  supplierName: "",
  address: "",
  phone: "",
  fax: "",
  email: "",
  website: "",
  notes: "",
};

function SectionTabs({ active, onChange }) {
  const tabs = [
    { id: "comparison", label: "Supplier Comparison" },
    { id: "directory", label: "Supplier Directory" },
    { id: "contacts", label: "Supplier Contacts" },
    { id: "kitchen", label: "Kitchen & Equipment" },
    { id: "packaging", label: "Packaging & Disposables" },
    { id: "hotelware", label: "Hotelware & OS&E" },
    { id: "import", label: "Import Supplier Workbook" },
    { id: "performance", label: "Performance (existing)" },
  ];

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          className={active === t.id ? "primary-btn" : "secondary-btn"}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function WorkbookImportSection({ onImported }) {
  const [fileInfo, setFileInfo] = useState({ name: "", base64: "" });
  const [preview, setPreview] = useState(null);
  const [errors, setErrors] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const bytes = new Uint8Array(reader.result);
        let binary = "";
        bytes.forEach((b) => {
          binary += String.fromCharCode(b);
        });
        resolve(btoa(binary));
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(null);
    setErrors([]);
    setStatus("Reading file...");
    const base64 = await toBase64(file);
    setFileInfo({ name: file.name, base64 });
    setStatus("Ready for dry-run preview.");
  };

  const runImport = async (dryRun = true) => {
    if (!fileInfo.base64) {
      setErrors(["Please choose an .xlsx file first."]);
      return;
    }
    setLoading(true);
    setErrors([]);
    setStatus(dryRun ? "Running preview..." : "Importing...");
    try {
      const resp = await fetch(apiUrl("/api/suppliers/comparison/import"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileBase64: fileInfo.base64,
          fileName: fileInfo.name,
          dryRun,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErrors(data?.errors || [data?.message || "Import failed."]);
        setPreview(null);
        setStatus("");
        return;
      }
      setPreview(data.summary || {});
      setStatus(dryRun ? "Preview ready" : "Import complete");
      if (!dryRun && typeof onImported === "function") {
        onImported();
      }
    } catch (err) {
      console.error(err);
      setErrors(["Import failed. Please check console for details."]);
    } finally {
      setLoading(false);
    }
  };

  const sheets = [
    "Supplier_Comparison",
    "Supplier_Directory",
    "Supplier_Contacts",
    "Kitchen_Equipment",
    "Packaging_Disposables",
    "Hotelware_OSE",
  ];

  return (
    <div className="card">
      <h3 className="card-title">Import Supplier Workbook</h3>
      <p className="page-subtitle">
        Upload the prepared Excel file. A dry-run shows inserts/updates per sheet before applying changes.
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <input type="file" accept=".xlsx" onChange={handleFile} />
        {fileInfo.name && <span className="hint-text">Selected: {fileInfo.name}</span>}
      </div>

      {errors.length > 0 && (
        <div className="error-text">
          {errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      )}
      {status && <div className="hint-text">{status}</div>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        <button type="button" className="secondary-btn" disabled={loading} onClick={() => runImport(true)}>
          Dry-run / Preview
        </button>
        <button
          type="button"
          className="primary-btn"
          disabled={loading || !preview}
          onClick={() => runImport(false)}
        >
          Import and Save
        </button>
      </div>

      {preview && (
        <div className="card" style={{ marginTop: 12 }}>
          <h4>Preview summary</h4>
          <div className="table-wrapper" style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Sheet</th>
                  <th>Rows</th>
                  <th>Will Insert</th>
                  <th>Will Update</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sheets.map((sheet) => {
                  const s = preview[sheet] || {};
                  return (
                    <tr key={sheet}>
                      <td>{sheet}</td>
                      <td>{s.rows ?? 0}</td>
                      <td>{s.inserts ?? 0}</td>
                      <td>{s.updates ?? 0}</td>
                      <td>
                        {s.missing
                          ? `Missing columns: ${s.missing.join(", ")}`
                          : s.found === false
                          ? "Not found"
                          : "OK"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SuppliersSourcingHub() {
  const [activeTab, setActiveTab] = useState("comparison");
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = () => setRefreshKey((k) => k + 1);

  return (
    <div className="page">
      <h2 style={{ marginBottom: 4 }}>Suppliers &amp; Sourcing</h2>
      <p className="page-subtitle">
        Structured supplier comparison, directory, contacts, and imports for food cost control. Existing performance
        dashboard remains available under the Performance tab.
      </p>

      <SectionTabs active={activeTab} onChange={setActiveTab} />

      {activeTab === "comparison" && <ComparisonSection refreshKey={refreshKey} />}
      {activeTab === "directory" && <DirectorySection refreshKey={refreshKey} />}
      {activeTab === "contacts" && <ContactsSection refreshKey={refreshKey} />}
      {activeTab === "kitchen" && (
        <SimpleCatalogSection
          title="Kitchen & Equipment"
          endpoint="/api/suppliers/kitchen-equipment"
          refreshKey={refreshKey}
        />
      )}
      {activeTab === "packaging" && (
        <SimpleCatalogSection
          title="Packaging & Disposables"
          endpoint="/api/suppliers/packaging-disposables"
          refreshKey={refreshKey}
        />
      )}
      {activeTab === "hotelware" && (
        <SimpleCatalogSection
          title="Hotelware & OS&E"
          endpoint="/api/suppliers/hotelware-ose"
          refreshKey={refreshKey}
        />
      )}
      {activeTab === "import" && <WorkbookImportSection onImported={triggerRefresh} />}
      {activeTab === "performance" && <SupplierPerformanceHub />}
    </div>
  );
}
function SimpleCatalogSection({ title, endpoint, refreshKey }) {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ mainCategory: "", search: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [newRow, setNewRow] = useState({
    supplierName: "",
    mainCategory: "",
    typicalProducts: "",
    notes: "",
  });

  const loadRows = async () => {
    setLoading(true);
    setError("");
    try {
      const resp = await fetch(apiUrl(endpoint));
      if (!resp.ok) throw new Error(`Load failed ${resp.status}`);
      const data = await resp.json();
      setRows(data.rows || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load suppliers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, [refreshKey]);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (filters.mainCategory && r.mainCategory !== filters.mainCategory) return false;
        if (filters.search) {
          const q = filters.search.toLowerCase();
          if (
            !r.supplierName?.toLowerCase().includes(q) &&
            !r.typicalProducts?.toLowerCase().includes(q)
          ) {
            return false;
          }
        }
        return true;
      }),
    [rows, filters]
  );

  const persistRow = async (row) => {
    setError("");
    try {
      const resp = await fetch(apiUrl(endpoint), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row),
      });
      if (!resp.ok) throw new Error(`Save failed ${resp.status}`);
      await loadRows();
    } catch (err) {
      console.error(err);
      setError("Save failed. Supplier name is required.");
    }
  };

  const mainCategoryOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.mainCategory).filter(Boolean))),
    [rows]
  );

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3 className="card-title">{title}</h3>
        </div>
        <button type="button" className="secondary-btn" onClick={loadRows} disabled={loading}>
          Refresh
        </button>
      </div>

      <div className="filter-row" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <label>Main Category</label>
          <select
            value={filters.mainCategory}
            onChange={(e) => setFilters((f) => ({ ...f, mainCategory: e.target.value }))}
          >
            <option value="">All</option>
            {mainCategoryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Search</label>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            placeholder="supplier / products"
          />
        </div>
      </div>

      {error && <div className="error-text">{error}</div>}
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="table-wrapper" style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Main Category</th>
                <th>Typical Products / Focus</th>
                <th>Notes</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.supplierName}</td>
                  <td>
                    <input
                      type="text"
                      value={r.mainCategory || ""}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((row) => (row.id === r.id ? { ...row, mainCategory: e.target.value } : row))
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={r.typicalProducts || ""}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((row) =>
                            row.id === r.id ? { ...row, typicalProducts: e.target.value } : row
                          )
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={r.notes || ""}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((row) => (row.id === r.id ? { ...row, notes: e.target.value } : row))
                        )
                      }
                    />
                  </td>
                  <td>
                    <button type="button" className="secondary-btn" onClick={() => persistRow(r)}>
                      Save
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card" style={{ marginTop: 12 }}>
        <h4>Add Supplier</h4>
        <div
          className="grid two-col"
          style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}
        >
          {Object.keys(newRow).map((key) => (
            <div key={key} style={{ display: "flex", flexDirection: "column" }}>
              <label>
                {key === "supplierName"
                  ? "Supplier Name"
                  : key === "mainCategory"
                  ? "Main Category"
                  : key === "typicalProducts"
                  ? "Typical Products / Focus"
                  : "Notes"}
              </label>
              <input
                type="text"
                value={newRow[key]}
                onChange={(e) => setNewRow((prev) => ({ ...prev, [key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          className="primary-btn"
          style={{ marginTop: 12 }}
          onClick={() =>
            persistRow(newRow).then(() =>
              setNewRow({ supplierName: "", mainCategory: "", typicalProducts: "", notes: "" })
            )
          }
        >
          Add Supplier
        </button>
      </div>
    </div>
  );
}
function ContactsSection({ refreshKey }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ supplierName: "", search: "" });
  const [newRow, setNewRow] = useState({ ...blankContact });

  const loadRows = async () => {
    setLoading(true);
    setError("");
    try {
      const resp = await fetch(apiUrl("/api/suppliers/contacts"));
      if (!resp.ok) throw new Error(`Load failed ${resp.status}`);
      const data = await resp.json();
      setRows(data.rows || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load contacts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, [refreshKey]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filters.supplierName && r.supplierName !== filters.supplierName) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (
          !r.supplierName?.toLowerCase().includes(q) &&
          !r.address?.toLowerCase().includes(q) &&
          !r.notes?.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [rows, filters]);

  const supplierOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.supplierName).filter(Boolean))).sort(),
    [rows]
  );

  const persistRow = async (row) => {
    setError("");
    try {
      const resp = await fetch(apiUrl("/api/suppliers/contacts"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row),
      });
      if (!resp.ok) throw new Error(`Save failed ${resp.status}`);
      await loadRows();
    } catch (err) {
      console.error(err);
      setError("Save failed. Supplier name is required.");
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3 className="card-title">Supplier Contacts</h3>
          <p className="page-subtitle">Branch/office details with quick email/website links.</p>
        </div>
        <button type="button" className="secondary-btn" onClick={loadRows} disabled={loading}>
          Refresh
        </button>
      </div>

      <div className="filter-row" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <label>Supplier</label>
          <select
            value={filters.supplierName}
            onChange={(e) => setFilters((f) => ({ ...f, supplierName: e.target.value }))}
          >
            <option value="">All</option>
            {supplierOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Search</label>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            placeholder="address / notes"
          />
        </div>
      </div>

      {error && <div className="error-text">{error}</div>}
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="table-wrapper" style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Address</th>
                <th>Phone</th>
                <th>Fax</th>
                <th>Email</th>
                <th>Website</th>
                <th>Notes</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.supplierName}</td>
                  <td>
                    <input
                      type="text"
                      value={r.address || ""}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((row) => (row.id === r.id ? { ...row, address: e.target.value } : row))
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={r.phone || ""}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((row) => (row.id === r.id ? { ...row, phone: e.target.value } : row))
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={r.fax || ""}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((row) => (row.id === r.id ? { ...row, fax: e.target.value } : row))
                        )
                      }
                    />
                  </td>
                  <td>
                    {r.email ? (
                      <a href={`mailto:${r.email}`} style={{ fontWeight: 600 }}>
                        {r.email}
                      </a>
                    ) : (
                      <input
                        type="text"
                        value={r.email || ""}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((row) => (row.id === r.id ? { ...row, email: e.target.value } : row))
                          )
                        }
                      />
                    )}
                  </td>
                  <td>
                    {r.website ? (
                      <a href={r.website} target="_blank" rel="noreferrer">
                        {r.website}
                      </a>
                    ) : (
                      <input
                        type="text"
                        value={r.website || ""}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((row) => (row.id === r.id ? { ...row, website: e.target.value } : row))
                          )
                        }
                      />
                    )}
                  </td>
                  <td>
                    <input
                      type="text"
                      value={r.notes || ""}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((row) => (row.id === r.id ? { ...row, notes: e.target.value } : row))
                        )
                      }
                    />
                  </td>
                  <td>
                    <button type="button" className="secondary-btn" onClick={() => persistRow(r)}>
                      Save
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card" style={{ marginTop: 12 }}>
        <h4>Add Contact</h4>
        <div
          className="grid two-col"
          style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}
        >
          {Object.keys(blankContact).map((key) => (
            <div key={key} style={{ display: "flex", flexDirection: "column" }}>
              <label>
                {key === "supplierName"
                  ? "Supplier Name"
                  : key === "typicalProducts"
                  ? "Typical Products / Focus"
                  : key[0].toUpperCase() + key.slice(1)}
              </label>
              <input
                type="text"
                value={newRow[key]}
                onChange={(e) => setNewRow((prev) => ({ ...prev, [key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          className="primary-btn"
          style={{ marginTop: 12 }}
          onClick={() => persistRow(newRow).then(() => setNewRow({ ...blankContact }))}
        >
          Add Contact
        </button>
      </div>
    </div>
  );
}
function DirectorySection({ refreshKey }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ type: "", mainCategory: "", search: "" });
  const [newRow, setNewRow] = useState({ ...blankDirectory });

  const loadRows = async () => {
    setLoading(true);
    setError("");
    try {
      const resp = await fetch(apiUrl("/api/suppliers/directory"));
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Load failed: ${resp.status} ${text}`);
      }
      const data = await resp.json();
      setRows(data.rows || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load supplier directory.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, [refreshKey]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filters.type && r.type !== filters.type) return false;
      if (filters.mainCategory && !r.mainCategories?.toLowerCase().includes(filters.mainCategory.toLowerCase()))
        return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!r.supplierName?.toLowerCase().includes(q) && !r.notesStrategy?.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [rows, filters]);

  const persistRow = async (row) => {
    setError("");
    try {
      const resp = await fetch(apiUrl("/api/suppliers/directory"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row),
      });
      if (!resp.ok) throw new Error(`Save failed ${resp.status}`);
      await loadRows();
    } catch (err) {
      console.error(err);
      setError("Save failed. Ensure supplier name is provided.");
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3 className="card-title">Supplier Directory</h3>
          <p className="page-subtitle">Core list of suppliers across categories and strategies.</p>
        </div>
        <button type="button" className="secondary-btn" onClick={loadRows} disabled={loading}>
          Refresh
        </button>
      </div>

      <div className="filter-row" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <label>Main Categories</label>
          <input
            type="text"
            value={filters.mainCategory}
            onChange={(e) => setFilters((f) => ({ ...f, mainCategory: e.target.value }))}
            placeholder="contains..."
          />
        </div>
        <div>
          <label>Type</label>
          <input
            type="text"
            value={filters.type}
            onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
            placeholder="e.g. Food, Non-food"
          />
        </div>
        <div>
          <label>Search</label>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
        </div>
      </div>

      {error && <div className="error-text">{error}</div>}
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="table-wrapper" style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Main Categories</th>
                <th>Type</th>
                <th>Notes / Strategy</th>
                <th>Website</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.supplierName}</td>
                  <td>
                    <input
                      type="text"
                      value={r.mainCategories || ""}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((row) =>
                            row.id === r.id ? { ...row, mainCategories: e.target.value } : row
                          )
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={r.type || ""}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((row) => (row.id === r.id ? { ...row, type: e.target.value } : row))
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={r.notesStrategy || ""}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((row) =>
                            row.id === r.id ? { ...row, notesStrategy: e.target.value } : row
                          )
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={r.website || ""}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((row) => (row.id === r.id ? { ...row, website: e.target.value } : row))
                        )
                      }
                    />
                  </td>
                  <td>
                    <button type="button" className="secondary-btn" onClick={() => persistRow(r)}>
                      Save
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card" style={{ marginTop: 12 }}>
        <h4>Add Supplier</h4>
        <div
          className="grid two-col"
          style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}
        >
          {Object.keys(blankDirectory).map((key) => (
            <div key={key} style={{ display: "flex", flexDirection: "column" }}>
              <label>
                {key === "notesStrategy"
                  ? "Notes / Strategy"
                  : key === "mainCategories"
                  ? "Main Categories"
                  : key === "supplierName"
                  ? "Supplier Name"
                  : key === "website"
                  ? "Website"
                  : "Type"}
              </label>
              <input
                type="text"
                value={newRow[key]}
                onChange={(e) => setNewRow((prev) => ({ ...prev, [key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          className="primary-btn"
          style={{ marginTop: 12 }}
          onClick={() => persistRow(newRow).then(() => setNewRow({ ...blankDirectory }))}
        >
          Add Supplier
        </button>
      </div>
    </div>
  );
}

function numberOrNull(val) {
  const n = Number(val);
  return Number.isNaN(n) ? null : n;
}

function computeLowest(row) {
  const prices = [row.priceSupplier1, row.priceSupplier2, row.priceSupplier3]
    .map((p) => numberOrNull(p))
    .filter((p) => p !== null);
  if (!prices.length) return row.lowestPrice || "";
  const min = Math.min(...prices);
  return Number.isFinite(min) ? min : row.lowestPrice || "";
}

function ComparisonSection({ refreshKey }) {
  const { brandFilter } = useData();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [filters, setFilters] = useState({
    category: "",
    brand: brandFilter || "",
    menuSection: "",
    search: "",
  });
  const [newRow, setNewRow] = useState({ ...blankComparison });

  useEffect(() => {
    setFilters((prev) => ({ ...prev, brand: brandFilter || "" }));
  }, [brandFilter]);

  const loadRows = async () => {
    setLoading(true);
    setError("");
    try {
      const resp = await fetch(apiUrl("/api/suppliers/comparison"));
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Load failed: ${resp.status} ${text}`);
      }
      const data = await resp.json();
      setRows(data.rows || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load supplier comparison rows.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, [refreshKey]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filters.category && r.category !== filters.category) return false;
      if (filters.brand && r.brand !== filters.brand) return false;
      if (filters.menuSection && r.menuSection !== filters.menuSection) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!r.item?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, filters]);

  const categoryOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.category).filter(Boolean))), [rows]);
  const brandOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.brand).filter(Boolean))), [rows]);
  const menuOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.menuSection).filter(Boolean))),
    [rows]
  );

  const updateRowField = (id, field, value) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value, lowestPrice: computeLowest({ ...r, [field]: value }) } : r))
    );
  };

  const persistRow = async (row) => {
    setStatus("Saving...");
    setError("");
    try {
      const resp = await fetch(apiUrl("/api/suppliers/comparison"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Save failed: ${resp.status} ${text}`);
      }
      const data = await resp.json();
      setStatus("Saved");
      await loadRows();
      return data;
    } catch (err) {
      console.error(err);
      setStatus("");
      setError("Save failed. Check fields and try again.");
      return null;
    }
  };

  const handleAdd = async () => {
    if (!newRow.item) {
      setError("Item name is required.");
      return;
    }
    await persistRow(newRow);
    setNewRow({ ...blankComparison, brand: brandFilter || "" });
  };

  const exportFiltered = () => {
    exportToCsv("supplier_comparison.csv", comparisonFields, filtered);
  };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3 className="card-title">Supplier Comparison</h3>
          <p className="page-subtitle">
            Track cost-efficient suppliers per item and highlight lowest quotes. Filters are client-side so you can
            refine without refetching.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button type="button" className="secondary-btn" onClick={loadRows} disabled={loading}>
            Refresh
          </button>
          <button type="button" className="secondary-btn" onClick={exportFiltered}>
            Export CSV (filtered)
          </button>
        </div>
      </div>

      <div className="filter-row" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <label>Category</label>
          <select
            value={filters.category}
            onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
          >
            <option value="">All</option>
            {categoryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Brand</label>
          <select value={filters.brand} onChange={(e) => setFilters((f) => ({ ...f, brand: e.target.value }))}>
            <option value="">All</option>
            {brandOptions.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Menu Section</label>
          <select
            value={filters.menuSection}
            onChange={(e) => setFilters((f) => ({ ...f, menuSection: e.target.value }))}
          >
            <option value="">All</option>
            {menuOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Search Item</label>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            placeholder="Search by item"
          />
        </div>
      </div>

      {error && <div className="error-text">{error}</div>}
      {status && <div className="hint-text">{status}</div>}
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="table-wrapper" style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Brand</th>
                <th>Menu Section</th>
                <th>Item</th>
                <th>Spec / Notes</th>
                <th>Recommended Supplier</th>
                <th>Alt 1</th>
                <th>Alt 2</th>
                <th>Pack Size</th>
                <th>UOM</th>
                <th>Price 1</th>
                <th>Price 2</th>
                <th>Price 3</th>
                <th>Lowest</th>
                <th>Chosen Supplier</th>
                <th>Notes</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const priceVals = [r.priceSupplier1, r.priceSupplier2, r.priceSupplier3]
                  .map((p) => numberOrNull(p))
                  .filter((p) => p !== null);
                const minPrice = priceVals.length ? Math.min(...priceVals) : null;
                const isLowest = (value) => minPrice !== null && numberOrNull(value) === minPrice;
                return (
                  <tr key={r.id || `${r.item}-${r.brand}-${r.menuSection}`}>
                    <td>{r.category}</td>
                    <td>{r.brand}</td>
                    <td>{r.menuSection}</td>
                    <td style={{ fontWeight: 600 }}>{r.item}</td>
                    <td>{r.specNotes}</td>
                    <td>{r.recommendedSupplier}</td>
                    <td>{r.alternativeSupplier1}</td>
                    <td>{r.alternativeSupplier2}</td>
                    <td>{r.packSize}</td>
                    <td>{r.uom}</td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={r.priceSupplier1 ?? ""}
                        onChange={(e) => updateRowField(r.id, "priceSupplier1", e.target.value)}
                        style={isLowest(r.priceSupplier1) ? { fontWeight: 700, background: "#f8fafc" } : {}}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={r.priceSupplier2 ?? ""}
                        onChange={(e) => updateRowField(r.id, "priceSupplier2", e.target.value)}
                        style={isLowest(r.priceSupplier2) ? { fontWeight: 700, background: "#f8fafc" } : {}}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={r.priceSupplier3 ?? ""}
                        onChange={(e) => updateRowField(r.id, "priceSupplier3", e.target.value)}
                        style={isLowest(r.priceSupplier3) ? { fontWeight: 700, background: "#f8fafc" } : {}}
                      />
                    </td>
                    <td style={{ fontWeight: 700 }}>{computeLowest(r)}</td>
                    <td>
                      <input
                        type="text"
                        value={r.chosenSupplier || ""}
                        onChange={(e) => updateRowField(r.id, "chosenSupplier", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={r.notes || ""}
                        onChange={(e) => updateRowField(r.id, "notes", e.target.value)}
                      />
                    </td>
                    <td>
                      <button type="button" className="secondary-btn" onClick={() => persistRow(r)}>
                        Save
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <h4>Add Item</h4>
        <div
          className="grid two-col"
          style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}
        >
          {comparisonFields.slice(0, -1).map((field) => (
            <div key={field.key} style={{ display: "flex", flexDirection: "column" }}>
              <label>{field.label}</label>
              <input
                type={field.key.startsWith("price") || field.key === "lowestPrice" ? "number" : "text"}
                step="0.01"
                value={newRow[field.key] ?? ""}
                onChange={(e) => setNewRow((prev) => ({ ...prev, [field.key]: e.target.value }))}
              />
            </div>
          ))}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <label>Notes</label>
            <input
              type="text"
              value={newRow.notes}
              onChange={(e) => setNewRow((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </div>
        </div>
        <button type="button" className="primary-btn" style={{ marginTop: 12 }} onClick={handleAdd}>
          Add Item
        </button>
      </div>
    </div>
  );
}

export default SuppliersSourcingHub;
