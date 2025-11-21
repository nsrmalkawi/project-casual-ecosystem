// src/features/data-entry/DataEntryHub.jsx
import { useState, useEffect } from "react";
import { loadData } from "../../utils/storage";
import WasteEntry from "./WasteEntry"; // recipe-based waste section

// Helper to generate unique IDs
function makeId() {
  return Date.now().toString() + "-" + Math.random().toString(16).slice(2);
}

// LocalStorage-backed array hook
function useLocalArray(key) {
  const [rows, setRows] = useState(() => loadData(key, []) || []);

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(rows));
    } catch (e) {
      console.error("Failed to save", key, e);
    }
  }, [key, rows]);

  return [rows, setRows];
}

const SECTION_TABS = [
  { id: "sales", label: "Sales" },
  { id: "purchases", label: "Purchases / COGS" },
  { id: "waste", label: "Waste (Manual + Recipe)" },
  { id: "inventory", label: "Inventory / Items Master" },
  { id: "rent-opex", label: "Rent & Opex" },
  { id: "hr-labor", label: "HR / Labor" },
  { id: "petty-cash", label: "Petty Cash" },
];

function DataEntryHub() {
  const [activeSection, setActiveSection] = useState("sales");

  const [sales, setSales] = useLocalArray("pc_sales");
  const [purchases, setPurchases] = useLocalArray("pc_purchases");
  const [waste, setWaste] = useLocalArray("pc_waste");
  const [inventory, setInventory] = useLocalArray("pc_inventory");
  const [rentOpex, setRentOpex] = useLocalArray("pc_rent_opex");
  const [hr, setHr] = useLocalArray("pc_hr_labor");
  const [pettyCash, setPettyCash] = useLocalArray("pc_petty_cash");

  const formatNumber = (n) => {
    const x = Number(n || 0);
    if (Number.isNaN(x)) return "0.000";
    return x.toFixed(3);
  };

  const handleDeleteRow = (rows, setRows, rowId) => {
    setRows(rows.filter((row) => row.id !== rowId));
  };

  // ----------------- SALES -----------------
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
    // Block negative net sales
    if (field === "netSales") {
      const num = Number(value);
      if (Number.isNaN(num) || num < 0) {
        window.alert("Net sales cannot be negative.");
        return;
      }
    }

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
        Net sales by date, brand, and outlet. Date, brand, and outlet are
        required. Negative sales are not allowed.
      </p>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Brand</th>
              <th>Outlet</th>
              <th>Net Sales (JOD)</th>
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
              sales.map((row) => {
                const amount = Number(row.netSales ?? 0) || 0;
                const missingOutlet =
                  !row.outlet || row.outlet.toString().trim() === "";
                const missingBrand =
                  !row.brand || row.brand.toString().trim() === "";
                const missingDate = !row.date;
                const suspicious =
                  amount > 0 && (missingOutlet || missingBrand || missingDate);

                return (
                  <tr
                    key={row.id}
                    style={
                      suspicious
                        ? { backgroundColor: "#fef3c7" } // light amber
                        : undefined
                    }
                  >
                    <td>
                      <input
                        type="date"
                        required
                        value={row.date || ""}
                        onChange={(e) =>
                          handleSalesChange(row.id, "date", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        required
                        value={row.brand || ""}
                        onChange={(e) =>
                          handleSalesChange(row.id, "brand", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        required
                        value={row.outlet || ""}
                        onChange={(e) =>
                          handleSalesChange(row.id, "outlet", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={row.netSales || ""}
                        onChange={(e) =>
                          handleSalesChange(
                            row.id,
                            "netSales",
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
                          handleSalesChange(row.id, "notes", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() =>
                          handleDeleteRow(sales, setSales, row.id)
                        }
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })
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

  // ----------------- PURCHASES / COGS -----------------
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
        Total purchase cost for cost of goods sold (COGS). Suspicious if no
        supplier or cost ≤ 0.
      </p>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Brand</th>
              <th>Outlet</th>
              <th>Supplier</th>
              <th>Total Cost (JOD)</th>
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
              purchases.map((row) => {
                const amount = Number(row.totalCost ?? 0) || 0;
                const supplierMissing =
                  !row.supplier || row.supplier.toString().trim() === "";
                const suspicious =
                  supplierMissing || amount <= 0; // matches Data Health logic

                return (
                  <tr
                    key={row.id}
                    style={
                      suspicious
                        ? { backgroundColor: "#fee2e2" } // light red
                        : undefined
                    }
                  >
                    <td>
                      <input
                        type="date"
                        required
                        value={row.date || ""}
                        onChange={(e) =>
                          handlePurchaseChange(row.id, "date", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        required
                        value={row.brand || ""}
                        onChange={(e) =>
                          handlePurchaseChange(row.id, "brand", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        required
                        value={row.outlet || ""}
                        onChange={(e) =>
                          handlePurchaseChange(row.id, "outlet", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        required
                        value={row.supplier || ""}
                        onChange={(e) =>
                          handlePurchaseChange(
                            row.id,
                            "supplier",
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
                        value={row.totalCost || ""}
                        onChange={(e) =>
                          handlePurchaseChange(
                            row.id,
                            "totalCost",
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
                );
              })
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

  // ----------------- WASTE (MANUAL + RECIPE) -----------------
  const addWasteRow = () => {
    setWaste((prev) => [
      ...prev,
      {
        id: makeId(),
        wasteType: "manual",
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
          const qty = Number(
            field === "qty" ? value : updated.qty
          ) || 0;
          const unitCost = Number(
            field === "unitCost" ? value : updated.unitCost
          ) || 0;
          updated.costValue = qty * unitCost;
        }

        return updated;
      })
    );
  };

  const renderWasteSection = () => (
    <>
      <div className="card">
        <h3 className="card-title">Waste (Manual Line Items)</h3>
        <p className="page-subtitle">
          Simple, ad hoc waste entries not linked to a full recipe. Suspicious
          if qty = 0 but cost &gt; 0.
        </p>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Brand</th>
                <th>Outlet</th>
                <th>Item</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Unit Cost</th>
                <th>Cost Value</th>
                <th>Reason</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {waste.filter((w) => w.wasteType !== "recipe").length === 0 ? (
                <tr>
                  <td colSpan="11">No manual waste rows yet.</td>
                </tr>
              ) : (
                waste
                  .filter((w) => w.wasteType !== "recipe")
                  .map((row) => {
                    const qty = Number(row.qty ?? 0);
                    const costValue = Number(row.costValue ?? 0) || 0;
                    const suspicious =
                      (qty === 0 || !row.qty) && costValue > 0;

                    return (
                      <tr
                        key={row.id}
                        style={
                          suspicious
                            ? { backgroundColor: "#fef9c3" } // soft yellow
                            : undefined
                        }
                      >
                        <td>
                          <input
                            type="date"
                            required
                            value={row.date || ""}
                            onChange={(e) =>
                              handleWasteChange(
                                row.id,
                                "date",
                                e.target.value
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            required
                            value={row.brand || ""}
                            onChange={(e) =>
                              handleWasteChange(
                                row.id,
                                "brand",
                                e.target.value
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            required
                            value={row.outlet || ""}
                            onChange={(e) =>
                              handleWasteChange(
                                row.id,
                                "outlet",
                                e.target.value
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            required
                            value={row.item || ""}
                            onChange={(e) =>
                              handleWasteChange(
                                row.id,
                                "item",
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
                            value={row.qty || ""}
                            onChange={(e) =>
                              handleWasteChange(
                                row.id,
                                "qty",
                                e.target.value
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={row.unit || ""}
                            onChange={(e) =>
                              handleWasteChange(
                                row.id,
                                "unit",
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
                              handleWasteChange(
                                row.id,
                                "unitCost",
                                e.target.value
                              )
                            }
                          />
                        </td>
                        <td>{formatNumber(row.costValue || 0)}</td>
                        <td>
                          <input
                            type="text"
                            value={row.reason || ""}
                            onChange={(e) =>
                              handleWasteChange(
                                row.id,
                                "reason",
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
                              handleWasteChange(
                                row.id,
                                "notes",
                                e.target.value
                              )
                            }
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteRow(waste, setWaste, row.id)
                            }
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })
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
          + Add Manual Waste Row
        </button>
      </div>

      {/* Recipe-based waste entry (linked to recipes + inventory) */}
      <WasteEntry />
    </>
  );

  // ----------------- INVENTORY -----------------
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
              <th>Item Code</th>
              <th>Item Name</th>
              <th>Brand</th>
              <th>Outlet</th>
              <th>Unit</th>
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
                      required
                      value={row.itemCode || ""}
                      onChange={(e) =>
                        handleInventoryChange(
                          row.id,
                          "itemCode",
                          e.target.value
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      required
                      value={row.itemName || ""}
                      onChange={(e) =>
                        handleInventoryChange(
                          row.id,
                          "itemName",
                          e.target.value
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.brand || ""}
                      onChange={(e) =>
                        handleInventoryChange(
                          row.id,
                          "brand",
                          e.target.value
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.outlet || ""}
                      onChange={(e) =>
                        handleInventoryChange(
                          row.id,
                          "outlet",
                          e.target.value
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.unit || ""}
                      onChange={(e) =>
                        handleInventoryChange(
                          row.id,
                          "unit",
                          e.target.value
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.001"
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
                        handleInventoryChange(
                          row.id,
                          "notes",
                          e.target.value
                        )
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

  // ----------------- RENT & OPEX -----------------
  const addRentOpexRow = () => {
    setRentOpex((prev) => [
      ...prev,
      {
        id: makeId(),
        date: "",
        outlet: "",
        category: "",
        amount: "",
        notes: "",
      },
    ]);
  };

  const handleRentOpexChange = (rowId, field, value) => {
    setRentOpex((prev) =>
      prev.map((row) =>
        row.id === rowId ? { ...row, [field]: value } : row
      )
    );
  };

  const renderRentSection = () => (
    <div className="card">
      <h3 className="card-title">Rent & Opex</h3>
      <p className="page-subtitle">
        Operating expenses by outlet and category. Used in EBITDA.
      </p>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Outlet</th>
              <th>Category</th>
              <th>Amount (JOD)</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rentOpex.length === 0 ? (
              <tr>
                <td colSpan="6">No rent/opex rows yet.</td>
              </tr>
            ) : (
              rentOpex.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input
                      type="date"
                      required
                      value={row.date || ""}
                      onChange={(e) =>
                        handleRentOpexChange(
                          row.id,
                          "date",
                          e.target.value
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      required
                      value={row.outlet || ""}
                      onChange={(e) =>
                        handleRentOpexChange(
                          row.id,
                          "outlet",
                          e.target.value
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      required
                      value={row.category || ""}
                      onChange={(e) =>
                        handleRentOpexChange(
                          row.id,
                          "category",
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
                      value={row.amount || ""}
                      onChange={(e) =>
                        handleRentOpexChange(
                          row.id,
                          "amount",
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
                        handleRentOpexChange(
                          row.id,
                          "notes",
                          e.target.value
                        )
                      }
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() =>
                        handleDeleteRow(rentOpex, setRentOpex, row.id)
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
        onClick={addRentOpexRow}
      >
        + Add Rent/Opex Row
      </button>
    </div>
  );

  // ----------------- HR / LABOR -----------------
  const addHrRow = () => {
    setHr((prev) => [
      ...prev,
      {
        id: makeId(),
        date: "",
        outlet: "",
        employee: "",
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
        Labor cost per employee and outlet. Used in labor % of sales and EBITDA.
      </p>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Outlet</th>
              <th>Employee</th>
              <th>Hours</th>
              <th>Labor Cost (JOD)</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {hr.length === 0 ? (
              <tr>
                <td colSpan="7">No HR rows yet.</td>
              </tr>
            ) : (
              hr.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input
                      type="date"
                      required
                      value={row.date || ""}
                      onChange={(e) =>
                        handleHrChange(row.id, "date", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      required
                      value={row.outlet || ""}
                      onChange={(e) =>
                        handleHrChange(row.id, "outlet", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      required
                      value={row.employee || ""}
                      onChange={(e) =>
                        handleHrChange(row.id, "employee", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.001"
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
                        handleHrChange(
                          row.id,
                          "laborCost",
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

  // ----------------- PETTY CASH -----------------
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
        supplies, quick repairs, etc.).
      </p>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Brand</th>
              <th>Outlet</th>
              <th>Category</th>
              <th>Description</th>
              <th>Amount (JOD)</th>
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
                      required
                      value={row.date || ""}
                      onChange={(e) =>
                        handlePettyCashChange(
                          row.id,
                          "date",
                          e.target.value
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.brand || ""}
                      onChange={(e) =>
                        handlePettyCashChange(
                          row.id,
                          "brand",
                          e.target.value
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      required
                      value={row.outlet || ""}
                      onChange={(e) =>
                        handlePettyCashChange(
                          row.id,
                          "outlet",
                          e.target.value
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      required
                      value={row.category || ""}
                      onChange={(e) =>
                        handlePettyCashChange(
                          row.id,
                          "category",
                          e.target.value
                        )
                      }
                      placeholder="Cleaning, delivery, tools..."
                    />
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
                      placeholder="Short explanation"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={row.amount || ""}
                      onChange={(e) =>
                        handlePettyCashChange(
                          row.id,
                          "amount",
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
                        handlePettyCashChange(
                          row.id,
                          "notes",
                          e.target.value
                        )
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

  // ----------------- SWITCH -----------------
  const renderActiveSection = () => {
    switch (activeSection) {
      case "sales":
        return renderSalesSection();
      case "purchases":
        return renderPurchasesSection();
      case "waste":
        return renderWasteSection();
      case "inventory":
        return renderInventorySection();
      case "rent-opex":
        return renderRentSection();
      case "hr-labor":
        return renderHrSection();
      case "petty-cash":
        return renderPettyCashSection();
      default:
        return renderSalesSection();
    }
  };

  return (
    <div>
      <h2 className="page-title">Data Entry Hub</h2>
      <p className="page-subtitle">
        Maintain core data for the Project Casual ecosystem. All values are
        stored in your browser (localStorage) under the <code>pc_*</code> keys
        used by the reporting layer.
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
              backgroundColor:
                activeSection === tab.id ? "#e0e7ff" : "#ffffff",
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
