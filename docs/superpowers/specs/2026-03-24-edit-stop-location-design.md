# Edit Stop Location — Design Spec

**Date:** 2026-03-24
**Status:** Approved (v2 — post spec review)

## Problem

Geocoding sometimes picks the wrong city/country for an ambiguous stop name (e.g. a hotel name with no city context). Users need a way to correct the address and immediately see the pin move on the map.

## Approach

Mapbox Geocoding API v6 for address autocomplete (reuses existing token, zero new dependencies). On save, a new PATCH endpoint writes `address + lat + lng` to the DB. The client optimistically patches local trip state so the map pin updates without a page reload.

---

## Data Layer

### `PATCH /api/trips/[id]/stops/[stopId]`

**Auth:** Session required. Ownership verified by joining `Stop → Day → Trip` in a single Prisma query:

```ts
const stop = await prisma.stop.findUnique({
  where: { id: stopId },
  include: { day: { select: { trip: { select: { id: true, user_id: true } } } } },
});
```

If `stop` is null → 404. If `stop.day.trip.user_id !== session.user.id` → 403.

**Request body:**
```json
{ "address": "string", "lat": number, "lng": number }
```

All three fields are required. Missing or invalid fields → 400.

**Behaviour:** Updates `address`, `lat`, `lng` on the `Stop` record via `prisma.stop.update`.

**Response (200):**
```json
{ "stop": { "id": "...", "address": "...", "lat": 0.0, "lng": 0.0 } }
```

Note: the client calls PATCH for its side-effect (persisting to DB) and does not use the response body — `onSave` is called with coordinates already known from the user's autocomplete selection.

**Error responses:** 400 (missing/invalid fields), 401, 403, 404, 500.

No schema changes needed — `address`, `lat`, `lng` already exist on the `Stop` model.

---

## Components

### `EditLocationModal`

**File:** `components/EditLocationModal.tsx`
**Type:** Client component

**Props:**
```ts
interface EditLocationModalProps {
  stop: StopDetail;
  tripId: string;
  onSave: (stopId: string, address: string, lat: number, lng: number) => void;
  onClose: () => void;
}
```

**Behaviour:**
- Renders a modal overlay. Input pre-filled with `stop.address` if set; empty string if `stop.address` is null.
- If `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` is absent, the input renders in "unavailable" state with a message: "Location search unavailable."
- Debounces input 300ms, then fetches:
  `https://api.mapbox.com/search/geocode/v6/forward?q={query}&access_token={token}&limit=5&proximity=ip`
  The `proximity=ip` param biases results toward the user's current location, reducing wrong-country results.
- Displays up to 5 suggestions in a dropdown. Each suggestion shows the full place name from `properties.full_address` (or `properties.name` fallback).
- Selecting a suggestion stores `{ address: feature.properties.full_address ?? feature.properties.name, lat: feature.geometry.coordinates[1], lng: feature.geometry.coordinates[0] }` in local state — matching the coordinate extraction in `lib/geocode.ts`. The `full_address` fallback to `name` is for display in the dropdown label only; the stored address always prefers `full_address`. The dropdown collapses and the input shows the selected address.
- Editing the input after a selection clears the stored coordinates and re-enables the dropdown (Save re-disables until a new selection is made).
- "Save" button: disabled until coordinates are stored (i.e. a suggestion has been selected). On click, calls `PATCH /api/trips/[id]/stops/[stopId]` with `{ address, lat, lng }`, then calls `onSave(stopId, address, lat, lng)`.
- "Cancel" calls `onClose`.
- Escape key and clicking the overlay also call `onClose`.
- Inline error message on save failure: "Failed to save — try again."
- Loading spinner on the Save button while the PATCH is in-flight.

---

### `StopCard` changes

**New prop:** `onEdit?: () => void`

A `Pencil` (Lucide) icon button is added to the **collapsed header row** (next to the time/chevron area) so it is always accessible regardless of whether the stop has an address. This is important because stops with null addresses (geocoding failed entirely) also need an edit entry point.

The button is only rendered when `onEdit` is provided (optional prop — existing usages without edit support continue to work unchanged).

For stops with options (`hasOptions === true`), the edit pencil still appears — the stop's own address is distinct from its options' addresses and may still be wrong.

---

### `ItineraryTab` changes

**New prop:** `onEditStop?: (stopId: string) => void`

Each `StopCard` receives `onEdit={onEditStop ? () => onEditStop(stop.id) : undefined}`.

When `onEditStop` is not provided (e.g. in tests that don't supply it), `StopCard.onEdit` is `undefined` and the pencil is not rendered — backwards compatible.

---

### `MapTab` changes

**New prop:** `onEditStop?: (stopId: string) => void`

Each popup's HTML gains an "Edit location" link with a `data-edit-stop` attribute:
```html
<a data-edit-stop="{stopId}" href="#" style="...">Edit location</a>
```

This is added to hotel, regular stop, and option popups. For option popups, `data-edit-stop` references the **option's own id** (not the parent stop id) — options have their own address and coordinates. Wait: options do not have their own `id` field exposed in `StopOption` — they are identified by `order`. Decision: skip "Edit location" in option popups for now. Only hotel and regular stop popups get the link.

A delegated click listener is defined before the `.then()` call so the cleanup closure can reference it:

```ts
const handlePopupClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  const editBtn = target.closest("[data-edit-stop]");
  if (editBtn) {
    e.preventDefault();
    onEditStop?.(editBtn.getAttribute("data-edit-stop")!);
  }
};
```

Inside the `.then()` callback, after the existing `if (cancelled || !mapContainer.current) return` guard and after all markers have been added, attach the listener:

```ts
mapContainer.current.addEventListener("click", handlePopupClick);
```

It must be inside the `.then()` block and guarded by the existing `cancelled` check — not chained outside it — so it is never attached after the component has unmounted.

The cleanup return removes it:

```ts
return () => {
  cancelled = true;
  mapContainer.current?.removeEventListener("click", handlePopupClick);
  mapRef.current?.remove();
  mapRef.current = null;
};
```

---

### `TripCompanionClient` changes

**New local state:**
```ts
const [tripState, setTripState] = useState<TripDetail>(() => trip);
const [editingStopId, setEditingStopId] = useState<string | null>(null);
const [mapKey, setMapKey] = useState(0);
```

`tripState` is initialised from the server-fetched `trip` prop and mutated on save. All tab renders use `tripState.days` instead of `trip.days`.

**`handleLocationSave(stopId, address, lat, lng)`:**
1. Patches `tripState`: finds the stop across all days, updates `address`, `lat`, `lng`.
2. Increments `mapKey` to force `MapTab` to re-initialise with the updated coordinates. `mapViewportRef` (which lives on `TripCompanionClient`, not `MapTab`) survives the remount. After remount, `MapTab`'s useEffect runs with the restored `savedViewport` — the `forDay === selectedDay` check will still pass since the day hasn't changed, so the viewport is correctly restored after save. Accepted trade-off: if geocoding moved the corrected stop significantly, the restored viewport may not center the new pin; this is not worth extra complexity.
3. Clears `editingStopId`.

**`EditLocationModal`** is rendered when `editingStopId` is non-null. The matching stop is found by scanning all days in `tripState`.

**`MapTab`** receives `key={mapKey}` and `onEditStop={(id) => setEditingStopId(id)}` and `days={tripState.days}`.

**`ItineraryTab`** receives `days={tripState.days}` and `onEditStop={(id) => setEditingStopId(id)}`.

---

## UX Details

- Modal closes on "Cancel", on successful save, on Escape key, and on overlay click.
- "Save" is disabled until the user selects a suggestion from the dropdown (free-typed text cannot provide coordinates).
- Editing the input after selecting a suggestion re-disables Save and re-opens the dropdown.
- The pencil icon in `StopCard` is always in the collapsed header, so it's visible even when the card is not expanded.

---

## Testing

### `PATCH /api/trips/[id]/stops/[stopId]`
- 401 when unauthenticated
- 403 when trip belongs to another user
- 404 when stop does not exist
- 400 when `address`/`lat`/`lng` are missing or invalid
- 200 with updated fields on success

### `EditLocationModal`
- Renders with pre-filled address when `stop.address` is set; empty input when null
- Shows "unavailable" state when `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` is absent (use `vi.stubEnv`)
- Debounce fires fetch after 300ms — use `vi.useFakeTimers()` + `vi.advanceTimersByTime(300)`
- Suggestion list renders with fetched results
- Selecting a suggestion enables Save button
- Editing after selection disables Save button again
- Successful save calls `onSave` with correct args
- Failed PATCH shows error message
- Cancel calls `onClose`

### `StopCard`
- Pencil icon renders when `onEdit` is provided (regardless of whether `stop.address` is set)
- Pencil icon absent when `onEdit` is not provided
- Clicking pencil calls `onEdit`

### `ItineraryTab`
- Passes `onEdit={() => onEditStop(stop.id)}` to each StopCard when `onEditStop` is provided

### `TripCompanionClient`
- `handleLocationSave` updates the correct stop's `address`/`lat`/`lng` in tripState
- `handleLocationSave` increments `mapKey`
- `handleLocationSave` clears `editingStopId`

### MapTab popup click delegation
- Not unit-testable in jsdom (same Mapbox limitation as map init). Covered by the integration path through `TripCompanionClient`.
