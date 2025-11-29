-- db/suppliers_module.sql
-- Bootstrap tables for the Suppliers & Sourcing module.

CREATE TABLE IF NOT EXISTS supplier_directory (
  id SERIAL PRIMARY KEY,
  supplier_name TEXT NOT NULL UNIQUE,
  main_categories TEXT,
  type TEXT,
  notes_strategy TEXT,
  website TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_contacts (
  id SERIAL PRIMARY KEY,
  supplier_id INTEGER REFERENCES supplier_directory(id) ON DELETE SET NULL,
  supplier_name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  fax TEXT,
  email TEXT,
  website TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_supplier_contacts_supplier_name ON supplier_contacts (LOWER(supplier_name));

CREATE TABLE IF NOT EXISTS supplier_comparison (
  id SERIAL PRIMARY KEY,
  category TEXT,
  brand TEXT,
  menu_section TEXT,
  item TEXT NOT NULL,
  spec_notes TEXT,
  recommended_supplier TEXT,
  alternative_supplier1 TEXT,
  alternative_supplier2 TEXT,
  pack_size TEXT,
  uom TEXT,
  price_supplier1 NUMERIC,
  price_supplier2 NUMERIC,
  price_supplier3 NUMERIC,
  lowest_price NUMERIC,
  chosen_supplier TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_supplier_comparison_lookup
  ON supplier_comparison (LOWER(category), LOWER(brand), LOWER(menu_section), LOWER(item));

CREATE TABLE IF NOT EXISTS supplier_kitchen_equipment (
  id SERIAL PRIMARY KEY,
  supplier_name TEXT NOT NULL,
  main_category TEXT,
  typical_products TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_supplier_kitchen_equipment_supplier
  ON supplier_kitchen_equipment (LOWER(supplier_name));

CREATE TABLE IF NOT EXISTS supplier_packaging_disposables (
  id SERIAL PRIMARY KEY,
  supplier_name TEXT NOT NULL,
  main_category TEXT,
  typical_products TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_supplier_packaging_supplier
  ON supplier_packaging_disposables (LOWER(supplier_name));

CREATE TABLE IF NOT EXISTS supplier_hotelware_ose (
  id SERIAL PRIMARY KEY,
  supplier_name TEXT NOT NULL,
  main_category TEXT,
  typical_products TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_supplier_hotelware_supplier
  ON supplier_hotelware_ose (LOWER(supplier_name));
