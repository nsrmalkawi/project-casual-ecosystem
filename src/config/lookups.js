// src/config/lookups.js
import { loadData } from "../utils/storage";

// ---- Default master data lists ----

export const DEFAULT_BRANDS = [
  "Buns Meat Dough",
  "Fish Face",
  "Call Me Margherita",
  "Free The Fork",
  "Death by Crab",
  "Feast Hub",
  "Other",
];

export const DEFAULT_OUTLETS = [
  "Abdoun Dine-in",
  "Abdoun Takeaway",
  "Cloud Kitchen",
  "Mall Kiosk",
  "Events / Catering",
  "Other",
];

// Common sales channels
export const SALES_CHANNELS = [
  "Dine-in",
  "Takeaway",
  "Delivery",
  "Pickup",
  "Kiosk",
  "Catering / Events",
  "Other",
];

export const DEFAULT_WASTE_REASONS = [
  "Spoilage",
  "Overproduction",
  "Customer Complaint",
  "Trial / R&D",
  "Staff Meal",
  "Other",
];

export const DEFAULT_PETTY_CASH_CATEGORIES = [
  "Delivery tips",
  "Small tools",
  "Cleaning supplies",
  "Minor repair",
  "Office supplies",
  "Other",
];

export const DEFAULT_HR_ROLES = [
  "Kitchen",
  "Service",
  "Delivery",
  "Management",
  "Admin",
  "Other",
];

// Backwards-compatible named exports (in case other files already use them)
export const BRAND_OPTIONS = DEFAULT_BRANDS;
export const OUTLET_OPTIONS = DEFAULT_OUTLETS;
export const WASTE_REASON_OPTIONS = DEFAULT_WASTE_REASONS;
export const PETTY_CASH_CATEGORY_OPTIONS = DEFAULT_PETTY_CASH_CATEGORIES;
export const HR_ROLE_OPTIONS = DEFAULT_HR_ROLES;

// Aliases used by data-entry components
export const BRANDS = DEFAULT_BRANDS;
export const OUTLETS = DEFAULT_OUTLETS;

// ---- Helpers to persist lists in localStorage ----

function saveList(key, arr) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(arr));
  } catch (e) {
    console.error("Failed to save master data", key, e);
  }
}

export function getMasterData() {
  const brands =
    loadData("pc_brand_options", DEFAULT_BRANDS) || DEFAULT_BRANDS;
  const outlets =
    loadData("pc_outlet_options", DEFAULT_OUTLETS) || DEFAULT_OUTLETS;
  const wasteReasons =
    loadData("pc_waste_reason_options", DEFAULT_WASTE_REASONS) ||
    DEFAULT_WASTE_REASONS;
  const pettyCategories =
    loadData(
      "pc_petty_cash_category_options",
      DEFAULT_PETTY_CASH_CATEGORIES
    ) || DEFAULT_PETTY_CASH_CATEGORIES;
  const hrRoles =
    loadData("pc_hr_role_options", DEFAULT_HR_ROLES) || DEFAULT_HR_ROLES;

  return {
    brands,
    outlets,
    wasteReasons,
    pettyCategories,
    hrRoles,
  };
}

export function saveMasterData(partial) {
  if (partial.brands) {
    saveList("pc_brand_options", partial.brands);
  }
  if (partial.outlets) {
    saveList("pc_outlet_options", partial.outlets);
  }
  if (partial.wasteReasons) {
    saveList("pc_waste_reason_options", partial.wasteReasons);
  }
  if (partial.pettyCategories) {
    saveList(
      "pc_petty_cash_category_options",
      partial.pettyCategories
    );
  }
  if (partial.hrRoles) {
    saveList("pc_hr_role_options", partial.hrRoles);
  }
}
