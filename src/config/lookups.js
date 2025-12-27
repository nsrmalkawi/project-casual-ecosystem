// src/config/lookups.js
import { loadData } from "../utils/storage";

// ---- Default master data lists ----

export const DEFAULT_BRANDS = ["Marley's Burger"];
export const DEFAULT_OUTLETS = ["Marley's Burger Main Outlet"];
export const PRIMARY_BRAND = DEFAULT_BRANDS[0];
export const PRIMARY_OUTLET = DEFAULT_OUTLETS[0];
export const PRIMARY_BRAND_KEY = "marleys_burger";

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

// Rent / Opex
export const RENT_OPEX_CATEGORIES = [
  "Base rent",
  "Utilities",
  "Service charge",
  "Maintenance",
  "Insurance",
  "Security",
  "Depreciation / Amortization",
  "Interest / Tax",
  "Other",
];

export const RENT_FREQUENCY_OPTIONS = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "semiannual", label: "Semi-annual" },
  { value: "annual", label: "Annual" },
];

// Backwards-compatible named exports (in case other files already use them)
export const BRAND_OPTIONS = DEFAULT_BRANDS;
export const OUTLET_OPTIONS = DEFAULT_OUTLETS;
export const WASTE_REASON_OPTIONS = DEFAULT_WASTE_REASONS;
export const PETTY_CASH_CATEGORY_OPTIONS = DEFAULT_PETTY_CASH_CATEGORIES;
export const HR_ROLE_OPTIONS = DEFAULT_HR_ROLES;
export const HR_ROLES = DEFAULT_HR_ROLES;

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
  // Force single-restaurant exposure; other lists remain user-editable.
  const brands = DEFAULT_BRANDS;
  const outlets = DEFAULT_OUTLETS;
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
