# Project Casual Ecosystem

AI-assisted F&B analytics and operations toolkit built with React + Vite and a Node/Express backend. Supports Google Gemini for insights and a PostgreSQL (Neon) backend for persistence and exports (CSV/Excel).

## Run locally
1) Install deps: `npm install`
2) Set envs in `.env` (see `.env.example`):
   - `VITE_GOOGLE_CLOUD_API_KEY`, `VITE_GOOGLE_CLOUD_MODEL`
   - `DATABASE_URL` (Postgres/Neon) with `sslmode=require`
   - `PORT` (defaults to 3001 if unset)
   - If upgrading existing databases, run `db/add_rent_lease_fields.sql` to add lease metadata columns to `rent_opex` (frequency, landlord, lease_start, lease_end, is_rent_fixed).
3) Start dev (frontend + backend): `npm run dev`
   - Frontend: http://localhost:5173 (proxies `/api` to backend)
   - Backend: http://localhost:${PORT}
4) Health check: `curl http://localhost:${PORT}/api/health` (should show `hasDatabase: true` when DATABASE_URL is set)

## Deploy free (Render)
Backend (Web Service)
- Connect GitHub repo → root `.` → Build: `npm install` → Start: `node src/server.mjs`
- Environment: `DATABASE_URL`, `VITE_GOOGLE_CLOUD_API_KEY`, `VITE_GOOGLE_CLOUD_MODEL`
- Verify: `https://<backend>.onrender.com/api/health`

Frontend (Static Site)
- Build: `npm install && npm run build`
- Publish dir: `dist`
- Environment: `VITE_API_BASE=https://<backend>.onrender.com` plus `VITE_GOOGLE_CLOUD_API_KEY`, `VITE_GOOGLE_CLOUD_MODEL`

## Exports & snapshots
- CSV: `GET /api/export/<table>`
- Excel: `GET /api/export-xlsx/<table>`
- Tables allowed: sales, purchases, waste, recipe_waste, inventory_items, rent_opex, hr_payroll, petty_cash
- Cloud snapshots: `POST/GET /api/snapshot`
- In UI: Admin → Data Import/Export has download buttons (CSV/Excel) and snapshot save/load.

## Reporting (example)
- Sales summary: `GET /api/reports/sales-summary?from=YYYY-MM-DD&to=YYYY-MM-DD&brand=...&outlet=...`
- Purchases summary: `GET /api/reports/purchases-summary?from=...&to=...&brand=...&outlet=...&supplier=...&category=...`
- Waste summary: `GET /api/reports/waste-summary?from=...&to=...&brand=...&outlet=...&category=...&reason=...`
- HR summary: `GET /api/reports/hr-summary?from=...&to=...&brand=...&outlet=...&role=...`
- Rent/Opex summary: `GET /api/reports/rent-opex-summary?from=...&to=...&brand=...&outlet=...&category=...`
- Petty Cash summary: `GET /api/reports/petty-cash-summary?from=...&to=...&brand=...&outlet=...&category=...`
- Inventory summary: `GET /api/reports/inventory-summary?category=...&brand=...`

## NEW: Reports & KPI Center
- Config: `src/config/reportsConfig.js`
- UI: `src/features/reports/ReportsCenter.jsx` (shown under the Reports tab)
- Filterable cards with search/category; "Open" uses the configured route or tab.

## Mobile responsiveness
The layout adapts under 900px: stacked panels, wrapped nav buttons, compressed padding, and horizontal scroll on tables.
