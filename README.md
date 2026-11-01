# Coffee-T Store Frontend

Next.js and TypeScript storefront and café experiences. The online catalogue, cart, account, café discovery/reservations, mounted-table ordering, waiter workspace, TV display, and administration screens use the NestJS API.

## Local Setup

Use Node.js 20 or newer. From this directory:

```sh
npm install
cp .env.example .env.local
npm run dev
```

Set `NEXT_PUBLIC_API_URL` in `.env.local` to the reachable local API URL. Keep it aligned with `FRONTEND_ORIGIN` in the backend `.env`. If Windows cannot reach WSL services through `localhost`, use the WSL-reachable host for both values, then restart both applications. If you open the dev server from another host (for example the WSL IP), list it in `NEXT_ALLOWED_DEV_ORIGINS`.

Routes: `/` is the online store, `/account` is account, basket, orders, reservations and addresses (`?tab=basket|orders|reservations|addresses`), `/cafe` is café discovery/reservations, `/cafe/table/[tableCode]` is the mounted tablet experience, `/cafe/staff` is the staff workspace (kitchen queue, staff calls, cash payments, assisted orders), `/cafe/display/[cafeId]` is the order TV, and `/admin` is role-protected management.

Table tablets: when an admin creates a table, the admin page shows a one-time link of the form `/cafe/table/<code>#token=<token>`. Open it on the tablet; the token is read from the URL fragment (never sent to a server), stored on the device, and removed from the address bar. The local seed table is `bengaluru-demo-t1` with token `coffee-t-demo-table-token` (`/cafe/table/bengaluru-demo-t1#token=coffee-t-demo-table-token`); do not use that token outside the local seeded database.

Code layout: `src/lib/api.ts` is the single HTTP client (cookies, CSRF, timeouts, silent session refresh); `src/components/ui.tsx` holds the shared UI kit; `src/components/session-provider.tsx` exposes the signed-in user and basket count to every page.

Development payment controls are test-only and do not charge money. Production checkout is blocked until a real provider and verified server-side callback flow are configured.

## Checks

```sh
npm run typecheck
npm run build
```