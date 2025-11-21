// src/utils/validation.js
// Validation helpers using the central data model config.

import {
  SALES_FIELDS,
  PURCHASE_FIELDS,
  WASTE_FIELDS,
  RECIPE_WASTE_FIELDS,
  INVENTORY_FIELDS,
  RENT_OPEX_FIELDS,
  HR_FIELDS,
  PETTY_CASH_FIELDS,
} from "../config/dataModel";

const MODELS = {
  sales: SALES_FIELDS,
  purchases: PURCHASE_FIELDS,
  waste: WASTE_FIELDS,
  recipeWaste: RECIPE_WASTE_FIELDS,
  inventory: INVENTORY_FIELDS,
  rentOpex: RENT_OPEX_FIELDS,
  hr: HR_FIELDS,
  pettyCash: PETTY_CASH_FIELDS,
};

function isEmpty(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  return false;
}

export function validateRow(modelKey, row) {
  const fields = MODELS[modelKey];
  if (!fields) {
    // No model defined => treat as valid
    return { isValid: true, errors: {} };
  }

  const errors = {};

  fields.forEach((field) => {
    const v = row[field.key];

    // Required field check
    if (field.required && isEmpty(v)) {
      errors[field.key] = "Required";
      return;
    }

    // Type-specific checks
    if (field.type === "number" && !isEmpty(v)) {
      const num = Number(v);
      if (Number.isNaN(num)) {
        errors[field.key] = "Must be a number";
        return;
      }
      if (num < 0) {
        errors[field.key] = "Must be ≥ 0";
        return;
      }
    }

    // Date type: must be valid ISO date if not empty
    if (field.type === "date" && !isEmpty(v)) {
      const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!isoRegex.test(String(v))) {
        errors[field.key] = "Use format YYYY-MM-DD";
        return;
      }
    }
  });

  const isValid = Object.keys(errors).length === 0;
  return { isValid, errors };
}

export function validateRows(modelKey, rows) {
  const result = {};
  let allValid = true;

  rows.forEach((row) => {
    const { isValid, errors } = validateRow(modelKey, row); // Pass modelKey to validateRow
    result[row.id || "row"] = errors;
    if (!isValid) {
      allValid = false;
    }
  });

  return {isValid: allValid, errorsByRow: result };
}
