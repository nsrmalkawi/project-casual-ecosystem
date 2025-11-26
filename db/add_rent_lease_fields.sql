-- Adds lease metadata and rent flags to rent_opex.
-- Run once against your PostgreSQL database.

ALTER TABLE rent_opex
  ADD COLUMN IF NOT EXISTS is_rent_fixed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS frequency text,
  ADD COLUMN IF NOT EXISTS landlord text,
  ADD COLUMN IF NOT EXISTS lease_start date,
  ADD COLUMN IF NOT EXISTS lease_end date;
