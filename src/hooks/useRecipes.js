// src/hooks/useRecipes.js
import { useState, useEffect, useMemo } from "react";
import { loadData } from "../utils/storage";

const STORAGE_KEY = "pc_recipes";

// Cost per portion = Σ (qtyPerPortion * unitCost)
export function computeRecipeCostPerPortion(recipe) {
  if (!recipe || !Array.isArray(recipe.ingredients)) return 0;

  return recipe.ingredients.reduce((sum, ing) => {
    const qty = Number(ing.qtyPerPortion) || 0;
    const unitCost = Number(ing.unitCost) || 0;
    return sum + qty * unitCost;
  }, 0);
}

export default function useRecipes() {
  // Load from localStorage on first render
  const [recipes, setRecipes] = useState(() => {
    return loadData(STORAGE_KEY, []) || [];
  });

  // Persist to localStorage whenever recipes change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
    } catch (e) {
      console.error("Failed to save recipes to localStorage", e);
    }
  }, [recipes]);

  // Sorted by name to keep UI clean
  const sortedRecipes = useMemo(
    () =>
      [...recipes].sort((a, b) =>
        (a.name || "").localeCompare(b.name || "")
      ),
    [recipes]
  );

  return {
    recipes: sortedRecipes,
    setRecipes,
  };
}
