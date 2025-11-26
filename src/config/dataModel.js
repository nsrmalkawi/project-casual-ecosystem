// src/config/dataModel.js
// Central definition of all main data structures for Project Casual ecosystem.

export const SALES_FIELDS = [
  { key: "date", label: "Date", type: "date", required: true },
  { key: "brand", label: "Brand", type: "text", required: true },
  { key: "outlet", label: "Outlet", type: "text", required: true },
  { key: "channel", label: "Channel", type: "text", required: true },
  { key: "orders", label: "Orders", type: "number", required: true },
  { key: "covers", label: "Covers", type: "number", required: false },
  { key: "grossSales", label: "Gross sales", type: "number", required: true },
  { key: "discounts", label: "Discounts", type: "number", required: false },
  { key: "netSales", label: "Net sales", type: "number", required: true },
  { key: "vat", label: "VAT", type: "number", required: false },
  { key: "deliveryFees", label: "Delivery fees", type: "number", required: false },
  { key: "notes", label: "Notes", type: "text", required: false },
];

export const PURCHASE_FIELDS = [
  { key: "date", label: "Date", type: "date", required: true },
  { key: "brand", label: "Brand", type: "text", required: true },
  { key: "outlet", label: "Outlet", type: "text", required: true },
  { key: "supplier", label: "Supplier", type: "text", required: true },
  { key: "category", label: "Category", type: "text", required: true },
  { key: "itemName", label: "Item", type: "text", required: true },
  { key: "unit", label: "Unit", type: "text", required: true },
  { key: "quantity", label: "Quantity", type: "number", required: true },
  { key: "unitCost", label: "Unit cost", type: "number", required: true },
  { key: "totalCost", label: "Total cost", type: "number", required: true },
  { key: "invoiceNo", label: "Invoice no.", type: "text", required: false },
  { key: "paymentTerm", label: "Payment term", type: "text", required: false },
  { key: "notes", label: "Notes", type: "text", required: false },
];

export const WASTE_FIELDS = [
  { key: "date", label: "Date", type: "date", required: true },
  { key: "brand", label: "Brand", type: "text", required: true },
  { key: "outlet", label: "Outlet", type: "text", required: true },
  { key: "category", label: "Category", type: "text", required: true },
  { key: "itemName", label: "Item", type: "text", required: true },
  { key: "reason", label: "Reason", type: "text", required: true },
  { key: "quantity", label: "Quantity", type: "number", required: true },
  { key: "unit", label: "Unit", type: "text", required: true },
  { key: "unitCost", label: "Unit cost", type: "number", required: true },
  { key: "totalCost", label: "Total cost", type: "number", required: true },
  { key: "notes", label: "Notes", type: "text", required: false },
];

export const RECIPE_WASTE_FIELDS = [
  { key: "date", label: "Date", type: "date", required: true },
  { key: "brand", label: "Brand", type: "text", required: true },
  { key: "outlet", label: "Outlet", type: "text", required: true },
  { key: "recipeId", label: "Recipe ID", type: "text", required: true },
  { key: "recipeName", label: "Recipe name", type: "text", required: true },
  { key: "quantitySold", label: "Qty sold (optional)", type: "number", required: false },
  { key: "quantityWasted", label: "Qty wasted", type: "number", required: true },
  { key: "wasteCost", label: "Waste cost", type: "number", required: true },
  { key: "reason", label: "Reason", type: "text", required: false },
  { key: "notes", label: "Notes", type: "text", required: false },
];

export const INVENTORY_FIELDS = [
  { key: "itemCode", label: "Item code", type: "text", required: true },
  { key: "itemName", label: "Item name", type: "text", required: true },
  { key: "category", label: "Category", type: "text", required: true },
  { key: "brand", label: "Brand (optional)", type: "text", required: false },
  { key: "defaultOutlet", label: "Default outlet", type: "text", required: false },
  { key: "unit", label: "Unit", type: "text", required: true },
  { key: "parLevel", label: "Par level", type: "number", required: false },
  { key: "minLevel", label: "Min level", type: "number", required: false },
  { key: "lastCost", label: "Last cost", type: "number", required: true },
  { key: "avgCost", label: "Average cost", type: "number", required: false },
  { key: "currentQty", label: "Current quantity", type: "number", required: false },
  { key: "notes", label: "Notes", type: "text", required: false },
];

export const RENT_OPEX_FIELDS = [
  { key: "date", label: "Date", type: "date", required: true },
  { key: "brand", label: "Brand", type: "text", required: true },
  { key: "outlet", label: "Outlet", type: "text", required: true },
  { key: "category", label: "Category", type: "text", required: true },
  { key: "description", label: "Description", type: "text", required: true },
  { key: "landlord", label: "Landlord / counterparty", type: "text", required: false },
  { key: "frequency", label: "Frequency", type: "text", required: false },
  { key: "leaseStart", label: "Lease start", type: "date", required: false },
  { key: "leaseEnd", label: "Lease end", type: "date", required: false },
  { key: "isRentFixed", label: "Is rent fixed", type: "boolean", required: false },
  { key: "amount", label: "Amount", type: "number", required: true },
  { key: "notes", label: "Notes", type: "text", required: false },
];

export const HR_FIELDS = [
  { key: "date", label: "Date", type: "date", required: true },
  { key: "brand", label: "Brand", type: "text", required: true },
  { key: "outlet", label: "Outlet", type: "text", required: true },
  { key: "employeeName", label: "Employee", type: "text", required: true },
  { key: "role", label: "Role", type: "text", required: true },
  { key: "hours", label: "Hours", type: "number", required: true },
  { key: "hourlyRate", label: "Hourly rate", type: "number", required: false },
  { key: "basePay", label: "Base pay", type: "number", required: true },
  { key: "overtimePay", label: "Overtime pay", type: "number", required: false },
  { key: "otherPay", label: "Other pay", type: "number", required: false },
  { key: "laborCost", label: "Total labor cost", type: "number", required: true },
  { key: "notes", label: "Notes", type: "text", required: false },
];

export const PETTY_CASH_FIELDS = [
  { key: "date", label: "Date", type: "date", required: true },
  { key: "brand", label: "Brand", type: "text", required: true },
  { key: "outlet", label: "Outlet", type: "text", required: true },
  { key: "category", label: "Category", type: "text", required: true },
  { key: "description", label: "Description", type: "text", required: true },
  { key: "amount", label: "Amount", type: "number", required: true },
  { key: "notes", label: "Notes", type: "text", required: false },
];
