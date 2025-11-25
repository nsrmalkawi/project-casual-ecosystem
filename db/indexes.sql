-- Recommended indexes for faster exports and reporting
-- Run once against your Neon database

-- Sales
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
CREATE INDEX IF NOT EXISTS idx_sales_brand_outlet_date ON sales(brand, outlet, date);

-- Purchases
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(date);
CREATE INDEX IF NOT EXISTS idx_purchases_brand_outlet_date ON purchases(brand, outlet, date);

-- Waste
CREATE INDEX IF NOT EXISTS idx_waste_date ON waste(date);
CREATE INDEX IF NOT EXISTS idx_waste_brand_outlet_date ON waste(brand, outlet, date);

-- HR / Payroll
CREATE INDEX IF NOT EXISTS idx_hr_payroll_date ON hr_payroll(date);
CREATE INDEX IF NOT EXISTS idx_hr_payroll_brand_outlet_date ON hr_payroll(brand, outlet, date);

-- Rent / Opex
CREATE INDEX IF NOT EXISTS idx_rent_opex_date ON rent_opex(date);

-- Petty Cash
CREATE INDEX IF NOT EXISTS idx_petty_cash_date ON petty_cash(date);

-- Inventory
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_item_code ON inventory_items(item_code);
