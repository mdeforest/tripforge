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
- Generated on demand via `POST /api/trips/[id]/share`; not auto-created at trip creation
- `@unique` prevents collisions

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
  @@map("trip_follows")
}
```

`onDelete: Cascade` on both FK sides: owner deletes trip → follows removed; follower deletes account → their follows removed.

---

## 2. Share Flow

### Generating a share link

- A "Share" button in the trip header (owner only) calls `POST /api/trips/[id]/share`
- Generates `crypto.randomUUID()` token, writes to `trip.share_token`, returns full share URL
- Idempotent: returns existing token if already set
- "Stop sharing" action: `DELETE /api/trips/[id]/share` → sets `share_token = null`
  - Existing followers retain their `TripFollow` record and can still view the trip
  - The link no longer works for new visitors

### Invite page: `/share/[token]`

- Not middleware-protected (the token is the auth mechanism)
- Unauthenticated visitors: redirect to `/login?callbackUrl=/share/[token]`
- Page shows: trip name, destination, date range, "Shared by [owner name]"
- "Save to my trips" button → `POST /api/share/[token]/follow` → redirects to `/trips/[tripId]`

**Edge cases:**
- Token not found → 404
- Owner visits their own share link → "You own this trip" with link to open it
- Already following → "Already saved" (disabled button) with link to open it

---

## 3. Trip Page — Owner vs. Follower

### `/trips/[id]/page.tsx`

Replace the hard ownership check with:
1. Is viewer the owner? → full access, `isOwner: true`
2. Does a `TripFollow` record exist for `(follower_id, trip_id)`? → read-only access, `isOwner: false`
3. Neither → `notFound()`

`isOwner` is passed as a prop to `TripCompanionClient`.

### Read-only UI differences for followers

| Location | Owner sees | Follower sees |
|---|---|---|
| Header subtitle | Destination | "Saved trip · Shared by [name]" |
| Header actions | Share button | Unsave button |
| Itinerary tab | Edit location links | Hidden |
| Map tab | Edit location popups | Hidden |
| Chat tab | Full AI chat | Full AI chat (independent session) |
| Checklist tab | Full management | Read-only (checkboxes disabled, no generate/add) |

`isOwner` threads through: `TripCompanionClient` → `ItineraryTab`, `MapTab`, `ChecklistTab`. `ChatTab` does not need it.

**Unsave:** Followers can remove the trip from their dashboard via an "Unsave" button, which calls `DELETE /api/trips/[id]/follow` and redirects to `/dashboard`.

---

## 4. Dashboard

Parallel queries:

```ts
const [ownedTrips, followedTrips] = await Promise.all([
  prisma.trip.findMany({ where: { user_id }, orderBy: ... }),
  prisma.tripFollow.findMany({
    where: { follower_id: userId },
    include: { trip: { include: { user: { select: { name: true } } } } },
    orderBy: { created_at: "desc" },
  }),
]);
```

- Renders **"My Trips"** section (owned) and **"Saved Trips"** section (followed) when followed trips exist
- If no followed trips: dashboard looks identical to today
- `TripCard` gains an optional `sharedBy?: string` prop — renders a "Shared by [name]" attribution line when present

---

## 5. API Routes

| Method | Path | Auth | Action |
|---|---|---|---|
| `POST` | `/api/trips/[id]/share` | Owner only | Generate `share_token`, return share URL |
| `DELETE` | `/api/trips/[id]/share` | Owner only | Set `share_token = null` |
| `GET` | `/api/share/[token]` | Public | Return trip preview for invite page |
| `POST` | `/api/share/[token]/follow` | Logged-in | Create `TripFollow`, return `{ tripId }` |
| `DELETE` | `/api/trips/[id]/follow` | Follower only | Delete `TripFollow`, return 204 |

**Existing route update:**
- `POST /api/trips/[id]/chat`: relax ownership check to allow followers (owner-or-follower pattern)

---

## 6. Testing

- Unit tests for all 5 new API routes (auth checks, idempotency, 404 on bad token)
- Unit test: `/share/[token]` page renders trip preview and "Save" button
- Unit test: `/trips/[id]` page renders read-only UI for follower (no edit links)
- Unit test: dashboard renders "Saved Trips" section for users with follows
- Unit test: `TripCard` renders `sharedBy` attribution when prop is present
- Existing trip page tests remain green (owner path unchanged)
