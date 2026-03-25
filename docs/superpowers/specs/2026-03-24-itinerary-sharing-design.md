# Itinerary Sharing — Design Spec

**Date:** 2026-03-24
**Issue:** [#8 — Sharing itineraries](https://github.com/mdeforest/tripforge/issues/8)

## Summary

Allow a trip owner to generate a share link. Any logged-in TripForge user who opens the link can save the trip to their dashboard. Saved trips are live read-only views — followers always see the owner's current itinerary data. Followers get the full companion UI (Itinerary, Map, Chat, Checklist) with edit controls hidden.

---

## 1. Schema

### `Trip` — add `share_token`

```prisma
share_token String? @unique
```

- `null` = sharing disabled (default)
- Token format: `crypto.randomBytes(32).toString("hex")` — 256-bit entropy, URL-safe
- Generated on demand; not auto-created at trip creation
- **Note:** The share token generation route must use the default Node.js runtime, not the edge runtime. `crypto.randomBytes` is not available on the edge.

### New `TripFollow` table

```prisma
model TripFollow {
  id          String   @id @default(cuid())
  follower_id String
  trip_id     String
  created_at  DateTime @default(now())

  follower User @relation(fields: [follower_id], references: [id], onDelete: Cascade)
  trip     Trip @relation(fields: [trip_id], references: [id], onDelete: Cascade)

  @@unique([follower_id, trip_id])
  @@index([follower_id])
  @@index([trip_id])
  @@map("trip_follows")
}
```

`onDelete: Cascade` on both FK sides: owner deletes trip → follows removed; follower deletes account → their follows removed.

---

## 2. Share Flow

### Generating a share link

- A "Share" button in the trip header (owner only) calls `POST /api/trips/[id]/share`
- **Idempotent:** if `trip.share_token` is already set, return the existing token as-is (no regeneration — would invalidate shared links). Returns `{ url: "${NEXTAUTH_URL}/share/${token}" }`. Base URL sourced from `process.env.NEXTAUTH_URL`.
- If `share_token` is `null`, generate a new token via `crypto.randomBytes(32).toString("hex")`, write it, then return `{ url }`.
- "Stop sharing" → `DELETE /api/trips/[id]/share`: sets `share_token = null`.
  - **Does not delete existing `TripFollow` records.** Followers retain access to `/trips/[id]` after revocation — they can still view the trip and unsave it independently. Revoking the share link stops new saves; it does not evict existing followers.

### Middleware

`/share/*` is **not** in the current middleware matcher (`/dashboard/:path*`, `/trips/:path*`). **Middleware stays unchanged.** Auth enforcement for `/share/[token]` is done with a manual server-side redirect inside the page component.

### Route group and layout for `/share/[token]`

The invite page lives at `app/share/[token]/page.tsx` — **outside all route groups** (not in `(app)/` or `(auth)/`). A minimal standalone layout at `app/share/layout.tsx` (no NavBar, no authenticated wrapper).

### Invite page: `app/share/[token]/page.tsx`

- Unauthenticated: `getServerSession` returns null → `redirect(\`/login?callbackUrl=/share/${token}\`)`
- Authenticated: fetches `GET /api/share/[token]` which returns `{ name, destination, start_date, end_date, ownerName }` — no stop details
- `ownerName` = `trip.user.name` (the trip owner's name, not the follower's); falls back to `"a TripForge user"` if empty string

**"Save to my trips" button:**
- Client calls `POST /api/share/[token]/follow`
- API returns `200 { tripId }` (idempotent — same 200 on repeat calls; implemented via `upsert` or `findUnique` + conditional `create`)
- Client calls `router.push(\`/trips/${tripId}\`)` after success
- If token not found or revoked (404): invite page shows error message "This share link is no longer active" — no redirect attempted

**"Unsave" button (in the trip page header for followers):**
- Client calls `DELETE /api/trips/[id]/follow`
- API returns 204 if `TripFollow` record exists and was deleted; 204 no-op if `TripFollow` not found (never 500); 404 if the `trip_id` itself does not exist in the DB
- Client calls `router.push("/dashboard")` after success

**Edge cases on the invite page:**
- Token not found or revoked → error message: "This share link is no longer active"
- Owner visits their own share link → "You own this trip" with link to `/trips/[tripId]`
- Already following → "Already saved" (disabled button) with link to `/trips/[tripId]`

---

## 3. Trip Page — Owner vs. Follower

### Updated Prisma query in `app/(app)/trips/[id]/page.tsx`

The existing `prisma.trip.findUnique` call must be extended to include the owner's name:

```ts
const trip = await prisma.trip.findUnique({
  where: { id: params.id },
  select: {
    id: true,
    user_id: true,
    name: true,
    destination: true,
    start_date: true,
    end_date: true,
    user: { select: { name: true } },   // ← ADD THIS
    days: { /* existing shape unchanged */ },
  },
});
```

### Updated access control

Replace the current `if (!trip || trip.user_id !== session.user.id) notFound()` with:

```ts
if (!trip) notFound();

const isOwner = trip.user_id === session.user.id;

const follow = !isOwner
  ? await prisma.tripFollow.findUnique({
      where: { follower_id_trip_id: { follower_id: session.user.id, trip_id: trip.id } },
    })
  : null;

if (!isOwner && !follow) notFound();

const ownerName: string | undefined = isOwner
  ? undefined
  : (trip.user.name || "a TripForge user");
```

Both `readOnly={!isOwner}` and `ownerName={ownerName}` are passed to `TripCompanionClient`. `ownerName` is `undefined` for owners (not needed in the owner UI).

### Component prop changes

**`TripCompanionClient`:**
```ts
interface TripCompanionClientProps {
  trip: TripDetail;
  checklist: ChecklistItem[];
  readOnly?: boolean;       // default false
  ownerName?: string;       // populated only for followers
}
```

- When `readOnly=true`: does **not** pass `onEditStop` to `ItineraryTab` or `MapTab`
- `EditLocationModal` is conditionally rendered: `{!readOnly && editingStop && <EditLocationModal ... />}`
- Header shows "Saved trip · Shared by [ownerName]" and Unsave button instead of Share button when `readOnly=true`

**`ItineraryTab`:** `onEditStop` becomes optional (`onEditStop?: (id: string) => void`); edit links only rendered when callback is provided.

**`MapTab`:** Same — `onEditStop` optional; edit popups only shown when callback is provided.

**`ChecklistTab`:**
```ts
interface ChecklistTabProps {
  tripId: string;
  initialItems: ChecklistItem[];
  readOnly?: boolean;       // default false
}
```
When `readOnly=true`: all mutation controls are hidden/disabled — checkboxes disabled, "Generate packing list" button hidden, "Add item" form hidden, delete buttons hidden. No mutation API calls are attempted. The API (`POST/PATCH/DELETE /api/trips/[id]/checklist`) still enforces owner-only for mutations as a defense-in-depth backstop: "follower PATCH attempts are prevented by both the disabled UI and the 403 from the API."

### Follower checklist state

Followers see **the owner's checklist items** (fetched identically to the owner path — items are scoped to `trip_id`). No schema change needed.

### Geocoding backfill

The existing geocoding backfill (writes coordinates back to `Stop` rows) runs for both owners and followers. This is intentional: the backfill only fills in missing geocoordinate data and is idempotent. A follower triggering a write to rows they don't own is acceptable because the data (coordinates) is objective and non-destructive.

### Read-only UI summary

| Location | Owner (`readOnly=false`) | Follower (`readOnly=true`) |
|---|---|---|
| Header subtitle | Destination | "Saved trip · Shared by [ownerName]" |
| Header actions | Share button | Unsave button |
| Itinerary tab | Edit location links | Hidden (no `onEditStop` prop) |
| Map tab | Edit location popups | Hidden (no `onEditStop` prop) |
| Edit location modal | Rendered when stop selected | Never rendered |
| Chat tab | Full AI chat | Full AI chat (independent session) |
| Checklist tab | Full management | Read-only (all mutation controls hidden) |

---

## 4. Dashboard

Parallel queries:

```ts
const [ownedTrips, followedTrips] = await Promise.all([
  prisma.trip.findMany({ where: { user_id }, orderBy: ... }),
  prisma.tripFollow.findMany({
    where: { follower_id: userId },
    include: { trip: { include: { user: { select: { name: true } } } } },
    // trip.user.name = the trip owner's name, not the follower's
    orderBy: { created_at: "desc" },
  }),
]);
```

- Renders **"My Trips"** section (owned) and **"Saved Trips"** section (followed) when followed trips exist
- "Saved Trips" hidden when `followedTrips.length === 0`
- Existing empty-state UI (Compass icon, "No trips yet" CTA) only renders when **both** `ownedTrips.length === 0` **and** `followedTrips.length === 0`
- `TripCard` gains an optional `sharedBy?: string` prop — renders "Shared by [name]" when present. Value: `follow.trip.user.name || "a TripForge user"`.

---

## 5. API Routes

| Method | Path | Auth | Action |
|---|---|---|---|
| `POST` | `/api/trips/[id]/share` | Owner only | Generate token (if null), return `{ url }` |
| `DELETE` | `/api/trips/[id]/share` | Owner only | Set `share_token = null`; keep TripFollow records |
| `GET` | `/api/share/[token]` | Public | Return `{ name, destination, start_date, end_date, ownerName }`; 404 if not found |
| `POST` | `/api/share/[token]/follow` | Logged-in | Upsert `TripFollow`, return `200 { tripId }`; 404 if token not found |
| `DELETE` | `/api/trips/[id]/follow` | Logged-in | Delete `TripFollow` if exists → 204; no `TripFollow` row → 204 (no-op); `trip_id` not in DB → 404 |

### Existing routes to update

- **`POST /api/trips/[id]/chat`**: relax to owner-or-follower
- **`GET /api/trips/[id]`**: relax to owner-or-follower (not on rendering critical path — trip page queries Prisma directly)
- **Checklist routes** (`/api/trips/[id]/checklist`):
  - `GET`: relax using new `getAuthorizedOrFollowerTrip()` helper (return type: `{ session, trip, isOwner: boolean } | { error: NextResponse }`)
  - `POST`, `PATCH`, `DELETE`: keep existing `getAuthorizedTrip()` (owner-only); existing tests unaffected

---

## 6. Testing

**`tests/setup.ts`:** Add `prisma.tripFollow` to the global Prisma mock with methods: `findUnique`, `create`, `findMany`, `delete`, `deleteMany`, `upsert`.

**New API routes (5 routes):**
- `POST /api/trips/[id]/share`: creates token, returns URL; returns same URL on second call; 403 for non-owner
- `DELETE /api/trips/[id]/share`: nulls token; does not delete follows; 403 for non-owner
- `GET /api/share/[token]`: returns preview fields; 404 on unknown/revoked token
- `POST /api/share/[token]/follow`: creates follow, returns `200 { tripId }`; returns `200 { tripId }` on repeat call (idempotent); 404 on bad token; 401 if not logged in
- `DELETE /api/trips/[id]/follow`: 204 when follow record exists; 204 when follow record not found (no-op); 404 when `trip_id` does not exist

**Invite page (`app/share/[token]/page.tsx`):**
- Redirects unauthenticated users to `/login?callbackUrl=/share/[token]`
- Shows preview + "Save to my trips" for authenticated non-owner non-follower
- Shows error message ("This share link is no longer active") for revoked/unknown token
- Shows "You own this trip" + link to `/trips/[tripId]` for owner
- Shows "Already saved" + link to `/trips/[tripId]` for existing follower

**Trip page (`app/(app)/trips/[id]/page.tsx`):**
- Renders read-only UI for follower: no edit links, no checklist mutation controls, no modal
- `notFound` for non-owner non-follower
- Existing owner tests remain green (owner path unchanged)

**Dashboard:**
- Renders "Saved Trips" section when follows exist
- Empty-state CTA only when both owned and followed trips are empty
- `TripCard` renders `sharedBy` attribution when prop is present

**Component unit tests:**
- `ChecklistTab` with `readOnly=true`: mutation controls not rendered
- `TripCompanionClient` with `readOnly=true`: `EditLocationModal` not rendered; `onEditStop` not passed to children
