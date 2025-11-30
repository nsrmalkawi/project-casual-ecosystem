// src/features/data-entry/DataEntryHub.jsx
import { useState, useEffect } from "react";
import { loadData } from "../../utils/storage";
import {
  getMasterData,
  DEFAULT_BRANDS,
  DEFAULT_OUTLETS,
  DEFAULT_WASTE_REASONS,
  DEFAULT_PETTY_CASH_CATEGORIES,
  DEFAULT_HR_ROLES,
} from "../../config/lookups";
import SalesSection from "./SalesSection";
import PurchasesEntry from "./PurchasesEntry";
import WasteEntry from "./WasteEntry";
import HREntry from "./HREntry";
import InventoryEntry from "./InventoryEntry";
import RentOpexEntry from "./RentOpexEntry";

// Tabs inside Data Entry Hub
const SECTION_TABS = [
  { id: "sales", label: "Sales" },
  { id: "purchases", label: "Purchases / COGS" },
  { id: "waste", label: "Waste (Manual)" },
  { id: "inventory", label: "Inventory / Items Master" },
  { id: "rent-opex", label: "Rent & Opex" },
  { id: "hr-labor", label: "HR / Labor" },
  { id: "petty-cash", label: "Petty Cash" },
];

// Helper: generate a simple unique ID
function makeId() {
  return Date.now().toString() + "-" + Math.random().toString(16).slice(2);
}

// Helper hook: sync an array with localStorage
function useLocalArray(key) {
  const [rows, setRows] = useState(() => loadData(key, []) || []);

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(rows));
    } catch (e) {
      console.error("Failed to save", key, e);
    }
  }, [key, rows]);

  return [rows, setRows];
}

function DataEntryHub() {
  const [activeSection, setActiveSection] = useState("sales");

  // All core datasets (legacy local caches)
  const [sales, setSales] = useLocalArray("pc_sales");
  const [purchases, setPurchases] = useLocalArray("pc_purchases");
  const [waste, setWaste] = useLocalArray("pc_waste");
  const [inventory, setInventory] = useLocalArray("pc_inventory");
  const [hr, setHr] = useLocalArray("pc_hr_labor");
  const [pettyCash, setPettyCash] = useLocalArray("pc_petty_cash");

  // Master data for dropdowns (loaded from localStorage via config/lookups.js)
  const [brandOptions, setBrandOptions] = useState(DEFAULT_BRANDS);
  const [outletOptions, setOutletOptions] = useState(DEFAULT_OUTLETS);
  const [wasteReasonOptions, setWasteReasonOptions] = useState(
    DEFAULT_WASTE_REASONS
  );
  const [pettyCashCategoryOptions, setPettyCashCategoryOptions] = useState(
    DEFAULT_PETTY_CASH_CATEGORIES
  );
  const [hrRoleOptions, setHrRoleOptions] = useState(DEFAULT_HR_ROLES);

  useEffect(() => {
    try {
      const master = getMasterData();
      if (master.brands?.length) setBrandOptions(master.brands);
      if (master.outlets?.length) setOutletOptions(master.outlets);
      if (master.wasteReasons?.length)
        setWasteReasonOptions(master.wasteReasons);
      if (master.pettyCategories?.length)
        setPettyCashCategoryOptions(master.pettyCategories);
      if (master.hrRoles?.length) setHrRoleOptions(master.hrRoles);
    } catch (e) {
      console.error("Failed to load master data", e);
    }
  }, []);

  const formatNumber = (n) => {
    const x = Number(n || 0);
    if (Number.isNaN(x)) return "0.000";
    return x.toFixed(3);
  };

  const handleDeleteRow = (rows, setRows, rowId) => {
    setRows(rows.filter((row) => row.id !== rowId));
  };

  // ---------- Common dropdown renderers ----------
  const renderBrandSelect = (value, onChange) => (
    <select value={value || ""} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select brand</option>
      {brandOptions.map((b) => (
        <option key={b} value={b}>
          {b}
        </option>
      ))}
    </select>
  );

  const renderOutletSelect = (value, onChange) => (
    <select value={value || ""} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select outlet</option>
      {outletOptions.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );

  // ============================================================
  // SALES
  // ============================================================
  const addSalesRow = () => {
    setSales((prev) => [
      ...prev,
      {
        id: makeId(),
        date: "",
        brand: "",
        outlet: "",
        netSales: "",
        notes: "",
      },
    ]);
  };

  const handleSalesChange = (rowId, field, value) => {
    setSales((prev) =>
      prev.map((row) =>
        row.id === rowId ? { ...row, [field]: value } : row
      )
    );
  };

  const renderSalesSection = () => (
    <div className="card">
      <h3 className="card-title">Sales</h3>
      <p className="page-subtitle">
        Net sales by date, brand, and outlet. This feeds all KPIs.
      </p>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Date*</th>
              <th>Brand*</th>
              <th>Outlet*</th>
              <th>Net Sales (JOD)*</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sales.length === 0 ? (
              <tr>
                <td colSpan="6">No sales rows yet.</td>
              </tr>
            ) : (
              sales.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input
                      type="date"
                      value={row.date || ""}
                      onChange={(e) =>
                        handleSalesChange(row.id, "date", e.target.value)
                      }
                      required
                    />
                  </td>
                  <td>
                    {renderBrandSelect(row.brand, (val) =>
                      handleSalesChange(row.id, "brand", val)
                    )}
                  </td>
                  <td>
                    {renderOutletSelect(row.outlet, (val) =>
                      handleSalesChange(row.id, "outlet", val)
                    )}
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={row.netSales || ""}
                      onChange={(e) =>
                        handleSalesChange(row.id, "netSales", e.target.value)
                      }
                      required
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.notes || ""}
                      onChange={(e) =>
                        handleSalesChange(row.id, "notes", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleDeleteRow(sales, setSales, row.id)}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="primary-btn"
        style={{ marginTop: 8 }}
        onClick={addSalesRow}
      >
        + Add Sales Row
      </button>
    </div>
  );

  // ============================================================
  // PURCHASES / COGS
  // ============================================================
  const addPurchaseRow = () => {
    setPurchases((prev) => [
      ...prev,
      {
        id: makeId(),
        date: "",
        brand: "",
        outlet: "",
        supplier: "",
        totalCost: "",
        notes: "",
      },
    ]);
  };

  const handlePurchaseChange = (rowId, field, value) => {
    setPurchases((prev) =>
      prev.map((row) =>
        row.id === rowId ? { ...row, [field]: value } : row
      )
    );
  };

  const renderPurchasesSection = () => (
    <div className="card">
      <h3 className="card-title">Purchases / COGS</h3>
      <p className="page-subtitle">
        Total purchase cost for cost of goods sold. Linked later to supplier
        dashboards and food cost%.
      </p>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Date*</th>
              <th>Brand*</th>
              <th>Outlet*</th>
              <th>Supplier*</th>
              <th>Total Cost (JOD)*</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {purchases.length === 0 ? (
              <tr>
                <td colSpan="7">No purchase rows yet.</td>
              </tr>
            ) : (
              purchases.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input
                      type="date"
                      value={row.date || ""}
                      onChange={(e) =>
                        handlePurchaseChange(row.id, "date", e.target.value)
                      }
                      required
                    />
                  </td>
                  <td>
                    {renderBrandSelect(row.brand, (val) =>
                      handlePurchaseChange(row.id, "brand", val)
                    )}
                  </td>
                  <td>
                    {renderOutletSelect(row.outlet, (val) =>
                      handlePurchaseChange(row.id, "outlet", val)
                    )}
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.supplier || ""}
                      onChange={(e) =>
                        handlePurchaseChange(row.id, "supplier", e.target.value)
                      }
                      required
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={row.totalCost || ""}
                      onChange={(e) =>
                        handlePurchaseChange(
                          row.id,
                          "totalCost",
                          e.target.value
                        )
                      }
                      required
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.notes || ""}
                      onChange={(e) =>
                        handlePurchaseChange(row.id, "notes", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() =>
                        handleDeleteRow(purchases, setPurchases, row.id)
                      }
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="primary-btn"
        style={{ marginTop: 8 }}
        onClick={addPurchaseRow}
      >
        + Add Purchase Row
      </button>
    </div>
  );

  // ============================================================
  // WASTE (MANUAL)
  // ============================================================
  const addWasteRow = () => {
    setWaste((prev) => [
      ...prev,
      {
        id: makeId(),
        date: "",
        brand: "",
        outlet: "",
        item: "",
        qty: "",
        unit: "",
        unitCost: "",
        costValue: "",
        reason: "",
        notes: "",
      },
    ]);
  };

  const handleWasteChange = (rowId, field, value) => {
    setWaste((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const updated = { ...row, [field]: value };

        if (field === "qty" || field === "unitCost") {
          const qty = Number(field === "qty" ? value : updated.qty) || 0;
          const unitCost =
            Number(field === "unitCost" ? value : updated.unitCost) || 0;
          updated.costValue = qty * unitCost;
        }

        return updated;
      })
    );
  };

  const renderWasteSection = () => (
    <div className="card">
      <h3 className="card-title">Waste (Manual Line Items)</h3>
      <p className="page-subtitle">
        Simple, ad hoc waste entries not linked to a full recipe. Recipe-based
        waste is handled in Recipes & Reconciliation tabs.
      </p>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Date*</th>
              <th>Brand*</th>
              <th>Outlet*</th>
              <th>Item*</th>
              <th>Qty*</th>
              <th>Unit*</th>
              <th>Unit Cost</th>
              <th>Cost Value</th>
              <th>Reason</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {waste.length === 0 ? (
              <tr>
                <td colSpan="11">No waste rows yet.</td>
              </tr>
            ) : (
              waste.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input
                      type="date"
                      value={row.date || ""}
                      onChange={(e) =>
                        handleWasteChange(row.id, "date", e.target.value)
                      }
                      required
                    />
                  </td>
                  <td>
                    {renderBrandSelect(row.brand, (val) =>
                      handleWasteChange(row.id, "brand", val)
                    )}
                  </td>
                  <td>
                    {renderOutletSelect(row.outlet, (val) =>
                      handleWasteChange(row.id, "outlet", val)
                    )}
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.item || ""}
                      onChange={(e) =>
                        handleWasteChange(row.id, "item", e.target.value)
                      }
                      required
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={row.qty || ""}
                      onChange={(e) =>
                        handleWasteChange(row.id, "qty", e.target.value)
                      }
                      required
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.unit || ""}
                      onChange={(e) =>
                        handleWasteChange(row.id, "unit", e.target.value)
                      }
                      required
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={row.unitCost || ""}
                      onChange={(e) =>
                        handleWasteChange(row.id, "unitCost", e.target.value)
                      }
                    />
                  </td>
                  <td>{formatNumber(row.costValue || 0)}</td>
                  <td>
                    <select
                      value={row.reason || ""}
                      onChange={(e) =>
                        handleWasteChange(row.id, "reason", e.target.value)
                      }
                    >
                      <option value="">Select reason</option>
                      {wasteReasonOptions.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.notes || ""}
                      onChange={(e) =>
                        handleWasteChange(row.id, "notes", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleDeleteRow(waste, setWaste, row.id)}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="primary-btn"
        style={{ marginTop: 8 }}
        onClick={addWasteRow}
      >
        + Add Waste Row
      </button>
    </div>
  );

  // ============================================================
  // INVENTORY
  // ============================================================
  const addInventoryRow = () => {
    setInventory((prev) => [
      ...prev,
      {
        id: makeId(),
        itemCode: "",
        itemName: "",
        brand: "",
        outlet: "",
        unit: "",
        currentQty: "",
        unitCost: "",
        notes: "",
      },
    ]);
  };

  const handleInventoryChange = (rowId, field, value) => {
    setInventory((prev) =>
      prev.map((row) =>
        row.id === rowId ? { ...row, [field]: value } : row
      )
    );
  };

  const renderInventorySection = () => (
    <div className="card">
      <h3 className="card-title">Inventory / Items Master</h3>
      <p className="page-subtitle">
        Items here should be referenced in recipes via{" "}
        <code>inventoryCode</code> = <code>itemCode</code>.
      </p>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Item Code*</th>
              <th>Item Name*</th>
              <th>Brand</th>
              <th>Outlet</th>
              <th>Unit*</th>
              <th>Current Qty</th>
              <th>Unit Cost</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {inventory.length === 0 ? (
              <tr>
                <td colSpan="9">No inventory rows yet.</td>
              </tr>
            ) : (
              inventory.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input
                      type="text"
                      value={row.itemCode || ""}
                      onChange={(e) =>
                        handleInventoryChange(
                          row.id,
                          "itemCode",
                          e.target.value
                        )
                      }
                      required
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.itemName || ""}
                      onChange={(e) =>
                        handleInventoryChange(
                          row.id,
                          "itemName",
                          e.target.value
                        )
                      }
                      required
                    />
                  </td>
                  <td>
                    {renderBrandSelect(row.brand, (val) =>
                      handleInventoryChange(row.id, "brand", val)
                    )}
                  </td>
                  <td>
                    {renderOutletSelect(row.outlet, (val) =>
                      handleInventoryChange(row.id, "outlet", val)
                    )}
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.unit || ""}
                      onChange={(e) =>
                        handleInventoryChange(row.id, "unit", e.target.value)
                      }
                      required
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={row.currentQty || ""}
                      onChange={(e) =>
                        handleInventoryChange(
                          row.id,
                          "currentQty",
                          e.target.value
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={row.unitCost || ""}
                      onChange={(e) =>
                        handleInventoryChange(
                          row.id,
                          "unitCost",
                          e.target.value
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.notes || ""}
                      onChange={(e) =>
                        handleInventoryChange(row.id, "notes", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() =>
                        handleDeleteRow(inventory, setInventory, row.id)
                      }
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="primary-btn"
        style={{ marginTop: 8 }}
        onClick={addInventoryRow}
      >
        + Add Inventory Row
      </button>
    </div>
  );

  // RENT & OPEX (handled via RentOpexEntry component)

  // ============================================================
  // HR / LABOR
  // ============================================================
  const addHrRow = () => {
    setHr((prev) => [
      ...prev,
      {
        id: makeId(),
        date: "",
        outlet: "",
        employee: "",
        role: "",
        hours: "",
        laborCost: "",
        notes: "",
      },
    ]);
  };

  const handleHrChange = (rowId, field, value) => {
    setHr((prev) =>
      prev.map((row) =>
        row.id === rowId ? { ...row, [field]: value } : row
      )
    );
  };

  const renderHrSection = () => (
    <div className="card">
      <h3 className="card-title">HR / Labor</h3>
      <p className="page-subtitle">
        Labor cost per employee and outlet. Used in labour% of sales and EBITDA.
      </p>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Date*</th>
              <th>Outlet*</th>
              <th>Employee*</th>
              <th>Role</th>
              <th>Hours</th>
              <th>Labor Cost (JOD)*</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {hr.length === 0 ? (
              <tr>
                <td colSpan="8">No HR rows yet.</td>
              </tr>
            ) : (
              hr.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input
                      type="date"
                      value={row.date || ""}
                      onChange={(e) =>
                        handleHrChange(row.id, "date", e.target.value)
                      }
                      required
                    />
                  </td>
                  <td>
                    {renderOutletSelect(row.outlet, (val) =>
                      handleHrChange(row.id, "outlet", val)
                    )}
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.employee || ""}
                      onChange={(e) =>
                        handleHrChange(row.id, "employee", e.target.value)
                      }
                      required
                    />
                  </td>
                  <td>
                    <select
                      value={row.role || ""}
                      onChange={(e) =>
                        handleHrChange(row.id, "role", e.target.value)
                      }
                    >
                      <option value="">Select role</option>
                      {hrRoleOptions.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      value={row.hours || ""}
                      onChange={(e) =>
                        handleHrChange(row.id, "hours", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={row.laborCost || ""}
                      onChange={(e) =>
                        handleHrChange(row.id, "laborCost", e.target.value)
                      }
                      required
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.notes || ""}
                      onChange={(e) =>
                        handleHrChange(row.id, "notes", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleDeleteRow(hr, setHr, row.id)}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="primary-btn"
        style={{ marginTop: 8 }}
        onClick={addHrRow}
      >
        + Add HR Row
      </button>
    </div>
  );

  // ============================================================
  // PETTY CASH
  // ============================================================
  const addPettyCashRow = () => {
    setPettyCash((prev) => [
      ...prev,
      {
        id: makeId(),
        date: "",
        brand: "",
        outlet: "",
        category: "",
        description: "",
        amount: "",
        notes: "",
      },
    ]);
  };

  const handlePettyCashChange = (rowId, field, value) => {
    setPettyCash((prev) =>
      prev.map((row) =>
        row.id === rowId ? { ...row, [field]: value } : row
      )
    );
  };

  const renderPettyCashSection = () => (
    <div className="card">
      <h3 className="card-title">Petty Cash</h3>
      <p className="page-subtitle">
        Track small daily expenses paid from petty cash (delivery tips, small
        tools, quick repairs, etc.).
      </p>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Date*</th>
              <th>Brand</th>
              <th>Outlet</th>
              <th>Category*</th>
              <th>Description*</th>
              <th>Amount (JOD)*</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pettyCash.length === 0 ? (
              <tr>
                <td colSpan="8">No petty cash entries yet.</td>
              </tr>
            ) : (
              pettyCash.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input
                      type="date"
                      value={row.date || ""}
                      onChange={(e) =>
                        handlePettyCashChange(row.id, "date", e.target.value)
                      }
                      required
                    />
                  </td>
                  <td>
                    {renderBrandSelect(row.brand, (val) =>
                      handlePettyCashChange(row.id, "brand", val)
                    )}
                  </td>
                  <td>
                    {renderOutletSelect(row.outlet, (val) =>
                      handlePettyCashChange(row.id, "outlet", val)
                    )}
                  </td>
                  <td>
                    <select
                      value={row.category || ""}
                      onChange={(e) =>
                        handlePettyCashChange(
                          row.id,
                          "category",
                          e.target.value
                        )
                      }
                      required
                    >
                      <option value="">Select category</option>
                      {pettyCashCategoryOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.description || ""}
                      onChange={(e) =>
                        handlePettyCashChange(
                          row.id,
                          "description",
                          e.target.value
                        )
                      }
                      required
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={row.amount || ""}
                      onChange={(e) =>
                        handlePettyCashChange(row.id, "amount", e.target.value)
                      }
                      required
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.notes || ""}
                      onChange={(e) =>
                        handlePettyCashChange(row.id, "notes", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() =>
                        handleDeleteRow(pettyCash, setPettyCash, row.id)
                      }
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="primary-btn"
        style={{ marginTop: 8 }}
        onClick={addPettyCashRow}
      >
        + Add Petty Cash Row
      </button>
    </div>
  );

  // ============================================================
  // SECTION SWITCH
  // ============================================================
  const renderActiveSection = () => {
    switch (activeSection) {
      case "sales":
        return (
          <SalesSection
            brandOptions={brandOptions}
            outletOptions={outletOptions}
          />
        );
      case "purchases":
        return (
          <PurchasesEntry
            brandOptions={brandOptions}
            outletOptions={outletOptions}
          />
        );
      case "waste":
        return (
          <WasteEntry
            brandOptions={brandOptions}
            outletOptions={outletOptions}
            wasteReasonOptions={wasteReasonOptions}
          />
        );
      case "inventory":
        return (
          <InventoryEntry
            brandOptions={brandOptions}
            outletOptions={outletOptions}
          />
        );
      case "rent-opex":
        return (
          <RentOpexEntry
            brandOptions={brandOptions}
            outletOptions={outletOptions}
          />
        );
      case "hr-labor":
        return (
          <HREntry
            brandOptions={brandOptions}
            outletOptions={outletOptions}
            roleOptions={hrRoleOptions}
          />
        );
      case "petty-cash":
        return renderPettyCashSection();
      default:
        return <SalesSection />;
    }
  };

  return (
    <div>
      <h2 className="page-title">Data Entry Hub</h2>
      <p className="page-subtitle">
        Maintain core data for the Project Casual ecosystem. Values are stored
        locally under <code>pc_*</code> keys and used by reporting, menu
        engineering, reconciliation, and AI insights.
      </p>

      {/* Section tabs */}
      <div
        className="section-tabs"
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        {SECTION_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveSection(tab.id)}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              border: "1px solid #c7d2fe",
              backgroundColor: activeSection === tab.id ? "#e0e7ff" : "#ffffff",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {renderActiveSection()}
    </div>
  );
}

export default DataEntryHub;



