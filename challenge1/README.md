# CriticalAsset Work Order Dashboard

**Challenge 01 · The City Hacks The State · NYC Tech Week 2026**

Pull the work orders. Build the dashboard. Turn data into decisions.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy env template and add your credentials
cp .env.example .env
# Edit .env with your CriticalAsset Client ID and Secret

# 3. Start the server
npm start
# or for auto-reload during development:
npm run dev

# 4. Open in browser
open http://localhost:3000
```

## Getting Your Credentials

1. Log into your CriticalAsset workspace
2. Open **Developer Console** (workspace menu)
3. Click **Create Application**
4. Name: `Hackathon — Work Orders Dashboard`
5. Grant type: **Server-to-Server / Client Credentials**
6. Scopes: `workorders:read`, `assets:read`, `locations:read`
7. Save → Copy the **Client ID** and **Client Secret** (shown once!)
8. Paste into your `.env` file

## Architecture

```
Browser → Express Server → CriticalAsset GraphQL API
           ↕                        ↕
      Token Cache              OAuth2 Token
      Student Signals          Work Orders + Assets + Locations
```

- **Backend** (`server.js`): Express server that handles OAuth2 authentication,
  caches tokens, proxies GraphQL requests, and stores student signals.
- **Frontend** (`public/index.html`): Single-page dashboard with counter cards,
  filterable table, detail panel, and student signal submission.

## Features

### Required
- ✅ Counter row: Open / In Progress / Overdue / Total
- ✅ Work order table with title, status, priority, asset, location, due date
- ✅ Filter by status and priority
- ✅ Search across all fields
- ✅ Detail panel on row click with full work order + linked asset

### Bonus
- ✅ Work orders joined to assets (category, status)
- ✅ Top 5 buildings by open work orders
- ✅ Student signal submission form

## Demo Mode

The dashboard runs in **Demo Mode** if no credentials are configured.
It loads realistic NYC school building work order data so you can
preview the UI and practice your demo.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/workorders` | Fetch work orders (query: limit, severity, status) |
| GET | `/api/assets` | Fetch assets for enrichment |
| GET | `/api/locations` | Fetch locations/buildings |
| POST | `/api/signals` | Submit a student signal observation |
| GET | `/api/health` | Health check + credential status |

## Common Issues

- **CORS errors**: Never call CriticalAsset directly from the browser. The server handles all API calls.
- **401 errors**: Token expired. The server auto-refreshes, but if you see this, restart the server.
- **403 errors**: Missing scope. Check your application scopes in Developer Console.
- **429 errors**: Rate limited. The server should back off and retry.

## Judging Criteria (100 pts)

| Criterion | Points |
|-----------|--------|
| Clarity of signal → action | 30 |
| Working data pull from CriticalAsset | 25 |
| Dashboard usability | 20 |
| Bonus: joins, map, student signal | 15 |
| Demo and storytelling | 10 |
