// src/features/waste/RecipeWasteEntry.jsx
import { useState } from "react";
import useRecipes, {
  computeRecipeCostPerPortion,
} from "../../hooks/useRecipes";
import { loadData } from "../../utils/storage";

const WASTE_KEY = "pc_waste";

function RecipeWasteEntry() {
  const { recipes } = useRecipes();

  const [form, setForm] = useState({
    date: "",
    brand: "",
    outlet: "",
    recipeId: "",
    portions: "",
    reason: "",
    notes: "",
  });

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (!form.date) {
      alert("Date is required.");
      return;
    }
    if (!form.recipeId) {
      alert("Please select a recipe.");
      return;
    }
    const portions = Number(form.portions) || 0;
    if (portions <= 0) {
      alert("Portions must be greater than zero.");
      return;
    }

    const recipe = recipes.find((r) => r.id === form.recipeId);
    if (!recipe) {
      alert("Selected recipe not found.");
      return;
    }

    const ingredientsBreakdown = (recipe.ingredients || []).map((ing) => {
      const qtyPerPortion = Number(ing.qtyPerPortion) || 0;
      const unitCost = Number(ing.unitCost) || 0;
      const qtyTotal = qtyPerPortion * portions;
      const lineCost = qtyTotal * unitCost;

      return {
        inventoryCode: ing.inventoryCode || "",
        ingredientName: ing.ingredientName || "",
        unit: ing.unit || "",
        qtyTotal,
        unitCost,
        lineCost,
      };
    });

    const costValue = ingredientsBreakdown.reduce(
      (sum, row) => sum + (row.lineCost || 0),
      0
    );

    const wasteRow = {
      id: Date.now().toString(),
      date: form.date,
      brand: form.brand || "",
      outlet: form.outlet || "",
      wasteType: "recipe",
      recipeId: recipe.id,
      recipeName: recipe.name,
      portions,
      reason: form.reason || "",
      notes: form.notes || "",
      costValue,
      ingredientsBreakdown,
    };

    const existing = loadData(WASTE_KEY, []) || [];
    const updated = [...existing, wasteRow];

    try {
      localStorage.setItem(WASTE_KEY, JSON.stringify(updated));
      alert("Recipe waste logged successfully.");
      setForm((prev) => ({
        ...prev,
        portions: "",
        reason: "",
        notes: "",
      }));
    } catch (e) {
      console.error("Failed to save waste row", e);
      alert("Failed to save waste row.");
    }
  };

  const selectedRecipe = recipes.find((r) => r.id === form.recipeId);
  const costPerPortion = selectedRecipe
    ? computeRecipeCostPerPortion(selectedRecipe)
    : 0;

  const formatNumber = (n) => {
    const x = Number(n || 0);
    if (Number.isNaN(x)) return "0.000";
    return x.toFixed(3);
  };

  return (
    <div className="card">
      <h3 className="card-title">Recipe-Based Waste Entry</h3>
      <p className="page-subtitle">
        Log waste by selecting a full recipe and the number of portions. The
        system calculates total ingredient cost and saves it into{" "}
        <code>pc_waste</code> with a link to inventory via{" "}
        <code>inventoryCode</code>.
      </p>

      <div className="form-grid">
        <div className="form-field">
          <label>Date</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => handleChange("date", e.target.value)}
          />
        </div>

        <div className="form-field">
          <label>Brand</label>
          <input
            type="text"
            value={form.brand}
            onChange={(e) => handleChange("brand", e.target.value)}
            placeholder="Optional"
          />
        </div>

        <div className="form-field">
          <label>Outlet</label>
          <input
            type="text"
            value={form.outlet}
            onChange={(e) => handleChange("outlet", e.target.value)}
            placeholder="Optional"
          />
        </div>

        <div className="form-field">
          <label>Recipe</label>
          <select
            value={form.recipeId}
            onChange={(e) => handleChange("recipeId", e.target.value)}
          >
            <option value="">Select recipe…</option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} {r.brand ? `(${r.brand})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label>Portions Wasted</label>
          <input
            type="number"
            step="0.001"
            value={form.portions}
            onChange={(e) => handleChange("portions", e.target.value)}
          />
        </div>

        <div className="form-field">
          <label>Waste Reason</label>
          <input
            type="text"
            value={form.reason}
            onChange={(e) => handleChange("reason", e.target.value)}
            placeholder="e.g. expired, overproduction, QC fail"
          />
        </div>

        <div className="form-field">
          <label>Notes</label>
          <input
            type="text"
            value={form.notes}
            onChange={(e) => handleChange("notes", e.target.value)}
            placeholder="Optional"
          />
        </div>

        {selectedRecipe && (
          <div className="form-field">
            <label>Cost per Portion (auto)</label>
            <div>{formatNumber(costPerPortion)} JOD</div>
          </div>
        )}
      </div>

      {selectedRecipe && form.portions && (
        <p className="page-subtitle" style={{ marginTop: 8 }}>
          Estimated total waste cost:{" "}
          <strong>
            {formatNumber(costPerPortion * (Number(form.portions) || 0))} JOD
          </strong>
        </p>
      )}

      <button
        type="button"
        className="primary-btn"
        style={{ marginTop: 12 }}
        onClick={handleSave}
      >
        Save Recipe Waste
      </button>
    </div>
  );
}

export default RecipeWasteEntry;
