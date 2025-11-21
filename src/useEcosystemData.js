// src/hooks/useEcosystemData.js
import { useMemo } from "react";
import { loadData } from "./utils/storage";

// Reusable KPI calculator
export function computeKpis({
  sales = [],
  purchases = [],
  waste = [],
  rentOpex = [],
  hr = [],
} = {}) {
  const totalSales = sales.reduce(
    (sum, row) => sum + (Number(row.netSales) || 0),
    0
  );

  const totalPurchases = purchases.reduce(
    (sum, row) => sum + (Number(row.totalCost) || 0),
    0
  );

  const totalWaste = waste.reduce(
    (sum, row) => sum + (Number(row.costValue) || 0),
    0
  );

  const totalOpex = rentOpex.reduce(
    (sum, row) => sum + (Number(row.amount) || 0),
    0
  );

  const totalLabor = hr.reduce(
    (sum, row) => sum + (Number(row.laborCost) || 0),
    0
  );

  // Depreciation & Amortization (category contains "deprec" or "amort")
  const depreciationAmortization = rentOpex
    .filter(
      (row) =>
        row.category && /deprec|amort/i.test(String(row.category))
    )
    .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

  // Interest & Tax (category contains "interest" or "tax")
  const interestTax = rentOpex
    .filter(
      (row) =>
        row.category && /interest|tax/i.test(String(row.category))
    )
    .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

  // Operating Opex = all Opex minus D&A and interest/tax
  const operatingOpex =
    totalOpex - depreciationAmortization - interestTax;

  // EBITDA ≈ Sales - COGS - operating Opex - labor
  const ebitda =
    totalSales - totalPurchases - operatingOpex - totalLabor;

  // Approximate Net Profit
  const netProfit = ebitda - depreciationAmortization - interestTax;

  const wastePercent =
    totalPurchases > 0 ? (totalWaste / totalPurchases) * 100 : 0;
  const laborPercentOfSales =
    totalSales > 0 ? (totalLabor / totalSales) * 100 : 0;
  const cogsPercentOfSales =
    totalSales > 0 ? (totalPurchases / totalSales) * 100 : 0;

  return {
    totalSales,
    totalPurchases,
    totalWaste,
    totalOpex,
    totalLabor,
    depreciationAmortization,
    interestTax,
    operatingOpex,
    ebitda,
    netProfit,
    wastePercent,
    laborPercentOfSales,
    cogsPercentOfSales,
  };
}

// Hook to load global data and KPIs
export function useEcosystemData() {
  const sales = loadData("pc_sales", []) || [];
  const purchases = loadData("pc_purchases", []) || [];
  const waste = loadData("pc_waste", []) || [];
  const inventory = loadData("pc_inventory", []) || [];
  const rentOpex = loadData("pc_rent_opex", []) || [];
  const hr = loadData("pc_hr_labor", []) || [];

  const kpis = useMemo(
    () =>
      computeKpis({
        sales,
        purchases,
        waste,
        rentOpex,
        hr,
      }),
    [sales, purchases, waste, rentOpex, hr]
  );

  return {
    sales,
    purchases,
    waste,
    inventory,
    rentOpex,
    hr,
    kpis,
  };
}

// Default export kept for safety
export default useEcosystemData;
