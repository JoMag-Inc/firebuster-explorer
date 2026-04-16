IMPORTANT:This client is programmed with maximum vibes(Claude + Codex ). It is made to be used for testing the firebuster api. 

# Firebuster Explorer

A small Vite + TypeScript frontend for testing Firebuster authentication and querying TTF data by coordinates.

## Requirements

- Node.js 18+
- npm 9+
- A running Firebuster API
- A running Keycloak instance configured for Firebuster

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment variables template:

   ```bash
   cp .env.example .env
   ```

3. Update `.env` values for your local stack.

## Run locally

```bash
npm run dev
```

Then open the local URL printed by Vite.

## Build

```bash
npm run build
```

## Notes

- `vite.config.ts` proxies:
  - `/realms` -> Keycloak (`http://localhost:8080`)
  - `/api` -> Firebuster API (`http://localhost:8000`)
- Do not commit `.env` (it is gitignored).
# firebuster-explorer
