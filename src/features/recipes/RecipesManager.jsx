// src/features/recipes/RecipesManager.jsx
import { useState, useEffect, useMemo } from "react";
import useRecipes, {
  computeRecipeCostPerPortion,
} from "../../hooks/useRecipes";

const emptyRecipe = {
  id: "",
  name: "",
  brand: "",
  outlet: "",
  category: "",
  portionSize: "",
  sellPrice: "",
  ingredients: [],
};

function newIngredientRow() {
  return {
    id: Date.now().toString() + "-" + Math.random().toString(16).slice(2),
    ingredientName: "",
    inventoryCode: "", // must match your inventory item code
    unit: "",
    qtyPerPortion: "",
    unitCost: "", // JOD per unit
  };
}

function formatNumber(n) {
  const x = Number(n || 0);
  if (Number.isNaN(x)) return "0.000";
  return x.toFixed(3);
}

function RecipesManager() {
  const { recipes, setRecipes } = useRecipes();

  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState({ ...emptyRecipe, ingredients: [] });

  // When selectedId changes, load that recipe into draft
  useEffect(() => {
    if (!selectedId) {
      setDraft({ ...emptyRecipe, ingredients: [] });
      return;
    }

    const found = recipes.find((r) => r.id === selectedId);
    if (found) {
      setDraft({
        ...found,
        ingredients: found.ingredients?.map((ing) => ({ ...ing })) || [],
      });
    }
  }, [selectedId, recipes]);

  const costPerPortion = useMemo(
    () => computeRecipeCostPerPortion(draft),
    [draft]
  );

  const grossMarginPerPortion = useMemo(() => {
    const sell = Number(draft.sellPrice) || 0;
    return sell - costPerPortion;
  }, [draft.sellPrice, costPerPortion]);

  // --------- Handlers ---------

  const handleFieldChange = (field, value) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleIngredientChange = (rowId, field, value) => {
    setDraft((prev) => ({
      ...prev,
      ingredients: (prev.ingredients || []).map((ing) =>
        ing.id === rowId ? { ...ing, [field]: value } : ing
      ),
    }));
  };

  const handleAddIngredient = () => {
    setDraft((prev) => ({
      ...prev,
      ingredients: [...(prev.ingredients || []), newIngredientRow()],
    }));
  };

  const handleRemoveIngredient = (rowId) => {
    setDraft((prev) => ({
      ...prev,
      ingredients: (prev.ingredients || []).filter(
        (ing) => ing.id !== rowId
      ),
    }));
  };

  const handleNewRecipe = () => {
    setSelectedId("");
    setDraft({ ...emptyRecipe, ingredients: [] });
  };

  const handleSave = () => {
    if (!draft.name.trim()) {
      alert("Recipe name is required.");
      return;
    }

    const isNew = !draft.id;
    const id = isNew ? Date.now().toString() : draft.id;

    const cleaned = {
      ...draft,
      id,
      sellPrice: Number(draft.sellPrice) || 0,
      ingredients: (draft.ingredients || []).filter(
        (ing) =>
          ing.ingredientName.trim() !== "" ||
          ing.inventoryCode.trim() !== ""
      ),
    };

    setRecipes((prev) => {
      if (isNew) {
        return [...prev, cleaned];
      }
      return prev.map((r) => (r.id === id ? cleaned : r));
    });

    setSelectedId(id);
  };

  const handleDelete = () => {
    if (!selectedId) return;
    if (!window.confirm("Delete this recipe?")) return;

    setRecipes((prev) => prev.filter((r) => r.id !== selectedId));
    setSelectedId("");
    setDraft({ ...emptyRecipe, ingredients: [] });
  };

  // --------- Render ---------

  return (
    <div>
      <h2 className="page-title">Recipes & Costing</h2>
      <p className="page-subtitle">
        Define recipes with ingredients linked to inventory codes. These will be
        used for waste and theoretical inventory usage.
      </p>

      {/* List of recipes */}
      <div className="card">
        <h3 className="card-title">Existing Recipes</h3>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Brand</th>
                <th>Outlet</th>
                <th>Category</th>
                <th>Cost / Portion</th>
                <th>Sell Price</th>
              </tr>
            </thead>
            <tbody>
              {recipes.length === 0 ? (
                <tr>
                  <td colSpan="6">No recipes yet.</td>
                </tr>
              ) : (
                recipes.map((r) => {
                  const c = computeRecipeCostPerPortion(r);
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      style={{
                        cursor: "pointer",
                        backgroundColor:
                          r.id === selectedId ? "#f0f4ff" : "transparent",
                      }}
                    >
                      <td>{r.name}</td>
                      <td>{r.brand}</td>
                      <td>{r.outlet}</td>
                      <td>{r.category}</td>
                      <td>{formatNumber(c)}</td>
                      <td>{formatNumber(r.sellPrice)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <button className="primary-btn" onClick={handleNewRecipe}>
          + New Recipe
        </button>
      </div>

      {/* Recipe editor */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3 className="card-title">
          {selectedId ? "Edit Recipe" : "New Recipe"}
        </h3>

        <div className="form-grid">
          <div className="form-field">
            <label>Recipe Name</label>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => handleFieldChange("name", e.target.value)}
            />
          </div>

          <div className="form-field">
            <label>Brand</label>
            <input
              type="text"
              value={draft.brand}
              onChange={(e) => handleFieldChange("brand", e.target.value)}
            />
          </div>

          <div className="form-field">
            <label>Outlet</label>
            <input
              type="text"
              value={draft.outlet}
              onChange={(e) => handleFieldChange("outlet", e.target.value)}
            />
          </div>

          <div className="form-field">
            <label>Category</label>
            <input
              type="text"
              value={draft.category}
              onChange={(e) => handleFieldChange("category", e.target.value)}
            />
          </div>

          <div className="form-field">
            <label>Portion Size (e.g. 1 sandwich)</label>
            <input
              type="text"
              value={draft.portionSize}
              onChange={(e) =>
                handleFieldChange("portionSize", e.target.value)
              }
            />
          </div>

          <div className="form-field">
            <label>Selling Price (JOD per portion)</label>
            <input
              type="number"
              step="0.001"
              value={draft.sellPrice}
              onChange={(e) =>
                handleFieldChange("sellPrice", e.target.value)
              }
            />
          </div>

          <div className="form-field">
            <label>Cost per Portion (auto)</label>
            <div>{formatNumber(costPerPortion)} JOD</div>
          </div>

          <div className="form-field">
            <label>Gross Margin per Portion (auto)</label>
            <div>{formatNumber(grossMarginPerPortion)} JOD</div>
          </div>
        </div>

        <h4 style={{ marginTop: 16 }}>Ingredients per Portion</h4>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Ingredient Name</th>
                <th>Inventory Code</th>
                <th>Unit</th>
                <th>Qty / Portion</th>
                <th>Unit Cost (JOD)</th>
                <th>Line Cost</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(draft.ingredients || []).length === 0 ? (
                <tr>
                  <td colSpan="7">No ingredients yet.</td>
                </tr>
              ) : (
                draft.ingredients.map((ing) => {
                  const lineCost =
                    (Number(ing.qtyPerPortion) || 0) *
                    (Number(ing.unitCost) || 0);
                  return (
                    <tr key={ing.id}>
                      <td>
                        <input
                          type="text"
                          value={ing.ingredientName}
                          onChange={(e) =>
                            handleIngredientChange(
                              ing.id,
                              "ingredientName",
                              e.target.value
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={ing.inventoryCode}
                          onChange={(e) =>
                            handleIngredientChange(
                              ing.id,
                              "inventoryCode",
                              e.target.value
                            )
                          }
                          placeholder="match inventory item code"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={ing.unit}
                          onChange={(e) =>
                            handleIngredientChange(
                              ing.id,
                              "unit",
                              e.target.value
                            )
                          }
                          placeholder="kg, g, piece..."
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.0001"
                          value={ing.qtyPerPortion}
                          onChange={(e) =>
                            handleIngredientChange(
                              ing.id,
                              "qtyPerPortion",
                              e.target.value
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.0001"
                          value={ing.unitCost}
                          onChange={(e) =>
                            handleIngredientChange(
                              ing.id,
                              "unitCost",
                              e.target.value
                            )
                          }
                        />
                      </td>
                      <td>{formatNumber(lineCost)}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleRemoveIngredient(ing.id)}
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
          onClick={handleAddIngredient}
        >
          + Add Ingredient
        </button>

        <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
          <button className="primary-btn" type="button" onClick={handleSave}>
            Save Recipe
          </button>
          {selectedId && (
            <button
              type="button"
              className="secondary-btn"
              onClick={handleDelete}
            >
              Delete Recipe
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default RecipesManager;
