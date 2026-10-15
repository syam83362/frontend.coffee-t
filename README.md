# Coffee-T Store Frontend

Next.js and TypeScript customer storefront. The home route is a Phase 1 storefront shell; the account route uses the NestJS API. Product browsing and purchasing will be added in later phases.

## Local Setup

Use Node.js 20 or newer. From this directory:

```sh
npm install
cp .env.example .env.local
npm run dev
```

Set `NEXT_PUBLIC_API_URL` in `.env.local` to the reachable local API URL. Keep it aligned with `FRONTEND_ORIGIN` in the backend `.env`. If Windows cannot reach WSL services through `localhost`, use the WSL-reachable host for both values, then restart both applications.

## Checks

```sh
npm run typecheck
npm run build
```