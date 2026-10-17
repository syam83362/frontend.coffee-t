# Coffee-T Store Frontend

Next.js and TypeScript storefront and café experiences. The online catalogue, cart, account, café discovery/reservations, mounted-table ordering, waiter workspace, TV display, and administration screens use the NestJS API.

## Local Setup

Use Node.js 20 or newer. From this directory:

```sh
npm install
cp .env.example .env.local
npm run dev
```

Set `NEXT_PUBLIC_API_URL` in `.env.local` to the reachable local API URL. Keep it aligned with `FRONTEND_ORIGIN` in the backend `.env`. If Windows cannot reach WSL services through `localhost`, use the WSL-reachable host for both values, then restart both applications.

Routes: `/` is the online store, `/account` is account/cart/order history, `/cafe` is café discovery/reservations, `/cafe/table/[tableCode]` is the mounted tablet experience, `/cafe/staff` is the waiter workspace, `/cafe/display/[cafeId]` is the order TV, and `/admin` is role-protected management. The local seed table is `bengaluru-demo-t1` with token `coffee-t-demo-table-token`; do not use that token outside the local seeded database.

Development payment controls are test-only and do not charge money. Production checkout is blocked until a real provider and verified server-side callback flow are configured.

## Checks

```sh
npm run typecheck
npm run build
```