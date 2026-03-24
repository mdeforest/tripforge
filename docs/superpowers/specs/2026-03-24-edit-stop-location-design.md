# Edit Stop Location — Design Spec

**Date:** 2026-03-24
**Status:** Approved

## Problem

Geocoding sometimes picks the wrong city/country for an ambiguous stop name (e.g. a hotel name with no city context). Users need a way to correct the address and immediately see the pin move on the map.

## Approach

Mapbox Geocoding API v6 for address autocomplete (reuses existing token, zero new dependencies). On save, a new PATCH endpoint writes `address + lat + lng` to the DB. The client optimistically patches local trip state so the map pin updates without a page reload.

---

## Data Layer

### `PATCH /api/trips/[id]/stops/[stopId]`

**Auth:** Session required; trip must belong to the authenticated user (401/403 otherwise).

**Request body:**
```json
{ "address": "string", "lat": number, "lng": number }
```

**Behaviour:** Updates `address`, `lat`, `lng` on the `Stop` record. All three fields are required.

**Response (200):**
```json
{ "stop": { "id": "...", "address": "...", "lat": 0.0, "lng": 0.0 } }
```

**Error responses:** 400 (missing/invalid fields), 401, 403, 404, 500.

No schema changes — `address`, `lat`, `lng` already exist on the `Stop` model.

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
- Renders a modal overlay with a search input pre-filled with `stop.address`.
- Debounces input (300ms), then fetches Mapbox Geocoding API v6:
  `https://api.mapbox.com/search/geocode/v6/forward?q={query}&access_token={token}&limit=5`
- Displays up to 5 suggestions in a dropdown. Each suggestion shows the full place name.
- Selecting a suggestion stores `{ address, lat, lng }` in local state and closes the dropdown.
- "Save" button: disabled until a suggestion has been selected (i.e. coordinates are known). On click, calls `PATCH /api/trips/[id]/stops/[stopId]`, then calls `onSave(stopId, address, lat, lng)`.
- "Cancel" calls `onClose`.
- Inline error message on save failure ("Failed to save — try again").
- Loading spinner on the Save button while the PATCH is in-flight.

---

### `StopCard` changes

When expanded and `stop.address` is set, render a `Pencil` (Lucide) icon button inline with the address text. Clicking it calls an `onEdit?: () => void` prop. The prop is optional so existing usages without edit support continue to work.

---

### `MapTab` changes

**New prop:** `onEditStop?: (stopId: string) => void`

Each popup's HTML gains an "Edit location" link:
```html
<a data-edit-stop="{stopId}" href="#" ...>Edit location</a>
```

A delegated `click` listener on the map container intercepts clicks on `[data-edit-stop]` elements, calls `event.preventDefault()`, and fires `onEditStop(stopId)`. The listener is registered once after the map loads and cleaned up in the `useEffect` return.

Hotels are included — the `data-edit-stop` attribute is added to hotel popups as well.

---

### `TripCompanionClient` changes

**Local state:**
```ts
const [trip, setTrip] = useState<TripDetail>(initialTrip);
const [editingStopId, setEditingStopId] = useState<string | null>(null);
const [mapKey, setMapKey] = useState(0);
```

`trip` is initialised from the server-fetched prop on mount and mutated on save.

**`handleLocationSave(stopId, address, lat, lng)`:**
1. Patches `trip` state: finds the stop across all days, updates `address`, `lat`, `lng`.
2. Increments `mapKey` to force `MapTab` to re-initialise with the updated coordinates.
3. Clears `editingStopId`.

**`EditLocationModal`** is conditionally rendered when `editingStopId` is non-null, using the matching stop from `trip` state.

**`MapTab`** receives `key={mapKey}` and `onEditStop={(id) => setEditingStopId(id)}`.

**`ItineraryTab`** passes `onEditStop` down to each `StopCard` via the day's stop list.

---

## UX Details

- Modal closes on "Cancel", on successful save, and on Escape key.
- Clicking outside the modal (overlay) also closes it.
- The "Save" button is disabled (greyed out) until the user has selected an autocomplete suggestion — free-typed text without a selection cannot provide coordinates.
- The search input clears the stored suggestion when the user edits after selecting, re-enabling the dropdown, so the Save button re-disables until a new suggestion is selected.

---

## Testing

- **`PATCH /api/trips/[id]/stops/[stopId]`:** auth (401, 403), not found (404), success (200 with updated fields), missing fields (400).
- **`EditLocationModal`:** renders with pre-filled address, debounce fires fetch, suggestion list renders, selecting a suggestion enables Save, successful save calls `onSave`, failed save shows error, Cancel calls `onClose`.
- **`StopCard`:** pencil icon appears when address is present and `onEdit` is provided; clicking it calls `onEdit`.
- **`TripCompanionClient`:** `handleLocationSave` updates the matching stop in state and increments `mapKey`.
- MapTab popup click delegation is not unit-testable in jsdom (same pattern as Mapbox map init) — covered by the integration path through `TripCompanionClient`.
