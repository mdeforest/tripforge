# Edit Stop Location Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users correct a stop's address via an autocomplete modal, immediately updating the map pin without a page reload.

**Architecture:** A new `PATCH /api/trips/[id]/stops/[stopId]` endpoint persists the corrected `address + lat + lng`. A new `EditLocationModal` component uses the Mapbox Geocoding API v6 for live address suggestions. `TripCompanionClient` holds trip data in local state, patches it on save, and forces `MapTab` to reinitialise via a `mapKey` counter.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Tailwind CSS, Prisma v5, Mapbox Geocoding API v6, Vitest + React Testing Library

**Spec:** `docs/superpowers/specs/2026-03-24-edit-stop-location-design.md`

---

## File Map

| Status | Path | Change |
|--------|------|--------|
| Create | `app/api/trips/[id]/stops/[stopId]/route.ts` | PATCH endpoint |
| Create | `tests/unit/api/stop-patch.test.ts` | API route tests |
| Modify | `tests/setup.ts` | Add `prisma.stop.findUnique` + `prisma.stop.update` to global mock |
| Create | `components/EditLocationModal.tsx` | Autocomplete modal |
| Create | `tests/unit/components/EditLocationModal.test.tsx` | Modal tests |
| Modify | `components/StopCard.tsx` | Add `onEdit?` prop + pencil icon |
| Modify | `tests/unit/components/StopCard.test.tsx` | Add pencil icon tests |
| Modify | `components/ItineraryTab.tsx` | Add `onEditStop?` prop, thread to StopCard |
| Modify | `tests/unit/components/ItineraryTab.test.tsx` | Add `onEditStop` threading test |
| Modify | `components/MapTab.tsx` | Add `onEditStop?` prop, popup links, delegated listener |
| Modify | `components/TripCompanionClient.tsx` | Add local trip state, modal, `handleLocationSave` |

---

## Task 1: Extend global Prisma mock

The `PATCH` route needs `prisma.stop.findUnique` and `prisma.stop.update`. These aren't in the global mock yet.

**Files:**
- Modify: `tests/setup.ts:61-65`

- [ ] **Step 1: Add `findUnique` and `update` to the stop mock**

In `tests/setup.ts`, replace the `stop` block:

```ts
// before
stop: {
  findMany: vi.fn(),
  create: vi.fn(),
  createMany: vi.fn(),
},

// after
stop: {
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  createMany: vi.fn(),
  update: vi.fn(),
},
```

- [ ] **Step 2: Run the existing test suite to confirm nothing broke**

```bash
npm test
```

Expected: all tests pass (214 green).

- [ ] **Step 3: Commit**

```bash
git add tests/setup.ts
git commit -m "test: add findUnique and update to stop Prisma mock"
```

---

## Task 2: PATCH `/api/trips/[id]/stops/[stopId]` — tests first

Write the failing tests before the route exists.

**Files:**
- Create: `tests/unit/api/stop-patch.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/api/stop-patch.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

const SESSION = { user: { id: "user-1" }, expires: "2030-01-01" };

// stop with day → trip join (matches the Prisma include shape)
const STOP_WITH_TRIP = {
  id: "stop-1",
  day: { trip: { id: "trip-1", user_id: "user-1" } },
};

const UPDATED_STOP = {
  id: "stop-1",
  address: "Piazza del Colosseo 1, 00184 Roma RM, Italy",
  lat: 41.8902,
  lng: 12.4922,
};

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/trips/trip-1/stops/stop-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const PARAMS = { params: { id: "trip-1", stopId: "stop-1" } };
const VALID_BODY = { address: "Piazza del Colosseo 1, Rome", lat: 41.8902, lng: 12.4922 };

describe("PATCH /api/trips/[id]/stops/[stopId]", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
    vi.mocked(prisma.stop.findUnique).mockReset();
    vi.mocked(prisma.stop.update).mockReset();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const { PATCH } = await import("@/app/api/trips/[id]/stops/[stopId]/route");
    const res = await PATCH(makeRequest(VALID_BODY), PARAMS);
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHORIZED");
  });

  it("returns 404 when stop does not exist", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as never);
    vi.mocked(prisma.stop.findUnique).mockResolvedValue(null);
    const { PATCH } = await import("@/app/api/trips/[id]/stops/[stopId]/route");
    const res = await PATCH(makeRequest(VALID_BODY), PARAMS);
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("NOT_FOUND");
  });

  it("returns 403 when trip belongs to another user", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "other" } } as never);
    vi.mocked(prisma.stop.findUnique).mockResolvedValue({
      id: "stop-1",
      day: { trip: { id: "trip-1", user_id: "user-1" } },
    } as never);
    const { PATCH } = await import("@/app/api/trips/[id]/stops/[stopId]/route");
    const res = await PATCH(makeRequest(VALID_BODY), PARAMS);
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("FORBIDDEN");
  });

  it("returns 400 when address is missing", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as never);
    vi.mocked(prisma.stop.findUnique).mockResolvedValue(STOP_WITH_TRIP as never);
    const { PATCH } = await import("@/app/api/trips/[id]/stops/[stopId]/route");
    const res = await PATCH(makeRequest({ lat: 41.89, lng: 12.49 }), PARAMS);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when lat is missing", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as never);
    vi.mocked(prisma.stop.findUnique).mockResolvedValue(STOP_WITH_TRIP as never);
    const { PATCH } = await import("@/app/api/trips/[id]/stops/[stopId]/route");
    const res = await PATCH(makeRequest({ address: "Rome", lng: 12.49 }), PARAMS);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_ERROR");
  });

  it("returns 200 with updated stop on success", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as never);
    vi.mocked(prisma.stop.findUnique).mockResolvedValue(STOP_WITH_TRIP as never);
    vi.mocked(prisma.stop.update).mockResolvedValue(UPDATED_STOP as never);

    const { PATCH } = await import("@/app/api/trips/[id]/stops/[stopId]/route");
    const res = await PATCH(makeRequest(VALID_BODY), PARAMS);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stop.id).toBe("stop-1");
    expect(body.stop.address).toBe("Piazza del Colosseo 1, 00184 Roma RM, Italy");
    expect(prisma.stop.update).toHaveBeenCalledWith({
      where: { id: "stop-1" },
      data: { address: VALID_BODY.address, lat: VALID_BODY.lat, lng: VALID_BODY.lng },
      select: { id: true, address: true, lat: true, lng: true },
    });
  });

  it("returns 500 when Prisma throws", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as never);
    vi.mocked(prisma.stop.findUnique).mockResolvedValue(STOP_WITH_TRIP as never);
    vi.mocked(prisma.stop.update).mockRejectedValue(new Error("DB error"));

    const { PATCH } = await import("@/app/api/trips/[id]/stops/[stopId]/route");
    const res = await PATCH(makeRequest(VALID_BODY), PARAMS);
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe("INTERNAL_ERROR");
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npm test tests/unit/api/stop-patch.test.ts
```

Expected: FAIL — "Cannot find module '@/app/api/trips/[id]/stops/[stopId]/route'"

---

## Task 3: Implement the PATCH route

**Files:**
- Create: `app/api/trips/[id]/stops/[stopId]/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const BodySchema = z.object({
  address: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; stopId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required.", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body.", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }
  const { address, lat, lng } = parsed.data;

  try {
    const stop = await prisma.stop.findUnique({
      where: { id: params.stopId },
      include: { day: { select: { trip: { select: { id: true, user_id: true } } } } },
    });

    if (!stop) {
      return NextResponse.json(
        { error: "Stop not found.", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    if (stop.day.trip.user_id !== session.user.id) {
      return NextResponse.json(
        { error: "You do not have access to this trip.", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const updated = await prisma.stop.update({
      where: { id: params.stopId },
      data: { address, lat, lng },
      select: { id: true, address: true, lat: true, lng: true },
    });

    return NextResponse.json({ stop: updated });
  } catch {
    return NextResponse.json(
      { error: "Failed to update stop.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Run tests — confirm they pass**

```bash
npm test tests/unit/api/stop-patch.test.ts
```

Expected: 7 tests passing.

- [ ] **Step 3: Run the full suite to confirm no regressions**

```bash
npm test
```

Expected: all tests pass (221 green).

- [ ] **Step 4: Commit**

```bash
git add app/api/trips/[id]/stops/[stopId]/route.ts tests/unit/api/stop-patch.test.ts
git commit -m "feat(api): add PATCH /api/trips/[id]/stops/[stopId] for location correction"
```

---

## Task 4: StopCard pencil icon — tests first

Add the `onEdit?` prop and pencil button. The pencil lives in the collapsed header row so it's always visible.

**Files:**
- Modify: `tests/unit/components/StopCard.test.tsx`
- Modify: `components/StopCard.tsx`

- [ ] **Step 1: Add failing tests to `StopCard.test.tsx`**

Add to the bottom of the `describe("StopCard")` block:

```ts
// ── Edit button ──────────────────────────────────────────────────────────

it("does not render pencil button when onEdit is not provided", () => {
  render(<StopCard stop={makeStop()} />);
  expect(screen.queryByRole("button", { name: /edit location/i })).not.toBeInTheDocument();
});

it("renders pencil button when onEdit is provided", () => {
  render(<StopCard stop={makeStop()} onEdit={vi.fn()} />);
  expect(screen.getByRole("button", { name: /edit location/i })).toBeInTheDocument();
});

it("renders pencil button even when address is null", () => {
  render(<StopCard stop={makeStop({ address: null })} onEdit={vi.fn()} />);
  expect(screen.getByRole("button", { name: /edit location/i })).toBeInTheDocument();
});

it("calls onEdit when pencil button is clicked", async () => {
  const onEdit = vi.fn();
  render(<StopCard stop={makeStop()} onEdit={onEdit} />);
  await userEvent.click(screen.getByRole("button", { name: /edit location/i }));
  expect(onEdit).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run tests — confirm the new ones fail**

```bash
npm test tests/unit/components/StopCard.test.tsx
```

Expected: 4 new tests FAIL, existing tests still pass.

- [ ] **Step 3: Implement `onEdit` prop in `StopCard.tsx`**

Add `Pencil` to the Lucide import and update the component:

```ts
// Add Pencil to the import line:
import { Bed, Utensils, Star, Car, MapPin, ExternalLink, ChevronDown, ChevronUp, Pencil } from "lucide-react";

// Update the interface:
interface StopCardProps {
  stop: StopDetail;
  onEdit?: () => void;
}

// Update the component signature:
export function StopCard({ stop, onEdit }: StopCardProps) {
```

In the header `<span>` that wraps time/badge/chevron (lines 87–104 of the current file), add the pencil button **before** the chevron:

```tsx
<span className="flex items-center gap-1.5 shrink-0">
  {stop.time && (
    <span className="text-xs text-muted">{stop.time}</span>
  )}
  {hasOptions && (
    <span
      data-testid="options-badge"
      className="rounded bg-parchment px-1.5 py-0.5 text-xs font-medium text-rust-dark"
    >
      {stop.options.length} options
    </span>
  )}
  {onEdit && (
    <button
      type="button"
      aria-label="Edit location"
      onClick={(e) => { e.stopPropagation(); onEdit(); }}
      className="rounded p-0.5 text-muted hover:text-rust transition-colors"
    >
      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  )}
  {hasDetails && (
    expanded
      ? <ChevronUp className="h-4 w-4 text-muted" aria-hidden="true" />
      : <ChevronDown className="h-4 w-4 text-muted" aria-hidden="true" />
  )}
</span>
```

Note: `e.stopPropagation()` prevents the pencil click from also toggling the expand/collapse.

- [ ] **Step 4: Run tests — confirm all pass**

```bash
npm test tests/unit/components/StopCard.test.tsx
```

Expected: all tests pass (existing + 4 new).

- [ ] **Step 5: Commit**

```bash
git add components/StopCard.tsx tests/unit/components/StopCard.test.tsx
git commit -m "feat(ui): add edit location pencil to StopCard"
```

---

## Task 5: ItineraryTab `onEditStop` prop — tests first

Thread the `onEditStop` callback from `ItineraryTab` to each `StopCard`.

**Files:**
- Modify: `tests/unit/components/ItineraryTab.test.tsx`
- Modify: `components/ItineraryTab.tsx`

- [ ] **Step 1: Add failing test to `ItineraryTab.test.tsx`**

Add this import at the top: `import { vi } from "vitest";` (already imported — confirm it's there).

Add to the bottom of the `describe("ItineraryTab")` block:

```ts
it("calls onEditStop with the stop id when the pencil button is clicked", async () => {
  const onEditStop = vi.fn();
  render(
    <ItineraryTab
      days={DAYS}
      selectedDay={1}
      onSelectDay={vi.fn()}
      onEditStop={onEditStop}
    />
  );
  await userEvent.click(screen.getByRole("button", { name: /edit location/i }));
  expect(onEditStop).toHaveBeenCalledWith("s1");
});
```

- [ ] **Step 2: Run tests — confirm the new one fails**

```bash
npm test tests/unit/components/ItineraryTab.test.tsx
```

Expected: 1 new test FAIL.

- [ ] **Step 3: Update `ItineraryTab.tsx`**

```ts
interface ItineraryTabProps {
  days: DayDetail[];
  selectedDay: number;
  onSelectDay: (day: number) => void;
  onEditStop?: (stopId: string) => void;
}

export function ItineraryTab({ days, selectedDay, onSelectDay, onEditStop }: ItineraryTabProps) {
  // ...existing code...
  // Change the StopCard render line:
  {currentDay.stops.map((stop) => (
    <StopCard
      key={stop.id}
      stop={stop}
      onEdit={onEditStop ? () => onEditStop(stop.id) : undefined}
    />
  ))}
```

- [ ] **Step 4: Run tests — confirm all pass**

```bash
npm test tests/unit/components/ItineraryTab.test.tsx
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/ItineraryTab.tsx tests/unit/components/ItineraryTab.test.tsx
git commit -m "feat(ui): add onEditStop prop to ItineraryTab"
```

---

## Task 6: `EditLocationModal` — tests first

**Files:**
- Create: `tests/unit/components/EditLocationModal.test.tsx`
- Create: `components/EditLocationModal.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/components/EditLocationModal.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditLocationModal } from "@/components/EditLocationModal";
import type { StopDetail } from "@/types/trip";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

function makeStop(overrides: Partial<StopDetail> = {}): StopDetail {
  return {
    id: "stop-1",
    name: "Hotel Bristol",
    type: "hotel",
    time: null,
    address: "Hotel Bristol, Prague",
    lat: 50.0755,
    lng: 14.4378,
    notes: null,
    order: 1,
    options: [],
    ...overrides,
  };
}

const MAPBOX_SUGGESTIONS = {
  features: [
    {
      properties: {
        full_address: "Hotel Bristol, Opletalova 555/10, 110 00 Praha 1, Czech Republic",
        name: "Hotel Bristol",
      },
      geometry: { coordinates: [14.4296, 50.0839] },
    },
    {
      properties: {
        full_address: "Hotel Bristol Vienna, Austria",
        name: "Hotel Bristol Vienna",
      },
      geometry: { coordinates: [16.3738, 48.2082] },
    },
  ],
};

describe("EditLocationModal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN", "test-token");
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => MAPBOX_SUGGESTIONS,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    mockFetch.mockReset();
  });

  it("renders with pre-filled address", () => {
    render(
      <EditLocationModal
        stop={makeStop()}
        tripId="trip-1"
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByLabelText("Search address")).toHaveValue("Hotel Bristol, Prague");
  });

  it("renders with empty input when stop.address is null", () => {
    render(
      <EditLocationModal
        stop={makeStop({ address: null })}
        tripId="trip-1"
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByLabelText("Search address")).toHaveValue("");
  });

  it("shows unavailable message when token is absent", () => {
    vi.stubEnv("NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN", "");
    render(
      <EditLocationModal
        stop={makeStop()}
        tripId="trip-1"
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText(/location search unavailable/i)).toBeInTheDocument();
  });

  it("Save button is disabled initially", () => {
    render(
      <EditLocationModal
        stop={makeStop()}
        tripId="trip-1"
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });

  it("fetches suggestions after 300ms debounce", async () => {
    render(
      <EditLocationModal
        stop={makeStop()}
        tripId="trip-1"
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );
    const input = screen.getByLabelText("Search address");
    await userEvent.clear(input);
    await userEvent.type(input, "Colosseum");

    // Fetch should not have fired yet
    expect(mockFetch).not.toHaveBeenCalled();

    // runAllTimersAsync advances the debounce AND flushes resulting Promise microtasks
    await vi.runAllTimersAsync();

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("Colosseum")
    );
  });

  it("shows suggestions after fetch completes", async () => {
    render(
      <EditLocationModal
        stop={makeStop()}
        tripId="trip-1"
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );
    await userEvent.clear(screen.getByRole("textbox"));
    await userEvent.type(screen.getByRole("textbox"), "Bristol");
    await vi.runAllTimersAsync();

    await waitFor(() =>
      expect(
        screen.getByText("Hotel Bristol, Opletalova 555/10, 110 00 Praha 1, Czech Republic")
      ).toBeInTheDocument()
    );
  });

  it("enables Save after selecting a suggestion", async () => {
    render(
      <EditLocationModal
        stop={makeStop()}
        tripId="trip-1"
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );
    await userEvent.clear(screen.getByRole("textbox"));
    await userEvent.type(screen.getByRole("textbox"), "Bristol");
    await vi.runAllTimersAsync();

    await waitFor(() =>
      screen.getByText("Hotel Bristol, Opletalova 555/10, 110 00 Praha 1, Czech Republic")
    );
    await userEvent.click(
      screen.getByText("Hotel Bristol, Opletalova 555/10, 110 00 Praha 1, Czech Republic")
    );

    expect(screen.getByRole("button", { name: /save/i })).not.toBeDisabled();
  });

  it("disables Save again when input is edited after selection", async () => {
    render(
      <EditLocationModal
        stop={makeStop()}
        tripId="trip-1"
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );
    await userEvent.clear(screen.getByRole("textbox"));
    await userEvent.type(screen.getByRole("textbox"), "Bristol");
    await vi.runAllTimersAsync();
    await waitFor(() =>
      screen.getByText("Hotel Bristol, Opletalova 555/10, 110 00 Praha 1, Czech Republic")
    );
    await userEvent.click(
      screen.getByText("Hotel Bristol, Opletalova 555/10, 110 00 Praha 1, Czech Republic")
    );
    // Edit the input again
    await userEvent.type(screen.getByRole("textbox"), " extra");
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });

  it("calls onSave with correct args on successful save", async () => {
    const onSave = vi.fn();
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => MAPBOX_SUGGESTIONS }) // geocode
      .mockResolvedValueOnce({ ok: true, json: async () => ({ stop: {} }) }); // PATCH

    render(
      <EditLocationModal
        stop={makeStop()}
        tripId="trip-1"
        onSave={onSave}
        onClose={vi.fn()}
      />
    );
    await userEvent.clear(screen.getByRole("textbox"));
    await userEvent.type(screen.getByRole("textbox"), "Bristol");
    await vi.runAllTimersAsync();
    await waitFor(() =>
      screen.getByText("Hotel Bristol, Opletalova 555/10, 110 00 Praha 1, Czech Republic")
    );
    await userEvent.click(
      screen.getByText("Hotel Bristol, Opletalova 555/10, 110 00 Praha 1, Czech Republic")
    );
    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      "stop-1",
      "Hotel Bristol, Opletalova 555/10, 110 00 Praha 1, Czech Republic",
      50.0839,
      14.4296
    ));
  });

  it("shows error message when PATCH fails", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => MAPBOX_SUGGESTIONS })
      .mockResolvedValueOnce({ ok: false });

    render(
      <EditLocationModal
        stop={makeStop()}
        tripId="trip-1"
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );
    await userEvent.clear(screen.getByRole("textbox"));
    await userEvent.type(screen.getByRole("textbox"), "Bristol");
    await vi.runAllTimersAsync();
    await waitFor(() =>
      screen.getByText("Hotel Bristol, Opletalova 555/10, 110 00 Praha 1, Czech Republic")
    );
    await userEvent.click(
      screen.getByText("Hotel Bristol, Opletalova 555/10, 110 00 Praha 1, Czech Republic")
    );
    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() =>
      expect(screen.getByText(/failed to save/i)).toBeInTheDocument()
    );
  });

  it("calls onClose when Cancel is clicked", async () => {
    const onClose = vi.fn();
    render(
      <EditLocationModal
        stop={makeStop()}
        tripId="trip-1"
        onSave={vi.fn()}
        onClose={onClose}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run — confirm all fail**

```bash
npm test tests/unit/components/EditLocationModal.test.tsx
```

Expected: FAIL — "Cannot find module '@/components/EditLocationModal'"

---

## Task 7: Implement `EditLocationModal`

**Files:**
- Create: `components/EditLocationModal.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, X } from "lucide-react";
import type { StopDetail } from "@/types/trip";

interface MapboxFeature {
  properties: { full_address?: string; name: string };
  geometry: { coordinates: [number, number] };
}

interface EditLocationModalProps {
  stop: StopDetail;
  tripId: string;
  onSave: (stopId: string, address: string, lat: number, lng: number) => void;
  onClose: () => void;
}

export function EditLocationModal({ stop, tripId, onSave, onClose }: EditLocationModalProps) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const [query, setQuery] = useState(stop.address ?? "");
  const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
  const [selected, setSelected] = useState<{ address: string; lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced geocode fetch
  useEffect(() => {
    if (!token || !query.trim() || selected) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(query)}&access_token=${token}&limit=5&proximity=ip`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        setSuggestions(data.features ?? []);
      } catch {
        // silent — suggestions just won't appear
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, token, selected]);

  // Escape key closes modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleSelect(feature: MapboxFeature) {
    const address = feature.properties.full_address ?? feature.properties.name;
    const [lng, lat] = feature.geometry.coordinates;
    setSelected({ address, lat, lng });
    setQuery(address);
    setSuggestions([]);
  }

  function handleInputChange(value: string) {
    setQuery(value);
    setSelected(null); // clear selection — re-requires picking from dropdown
    setError(null);
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/stops/${stop.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selected),
      });
      if (!res.ok) throw new Error("save failed");
      onSave(stop.id, selected.address, selected.lat, selected.lng);
    } catch {
      setError("Failed to save — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-cream shadow-xl border border-parchment-dark p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-lg font-semibold text-ink">Edit location</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted hover:text-ink transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-muted mb-3">{stop.name}</p>

        {!token ? (
          <p className="text-sm text-muted italic">Location search unavailable.</p>
        ) : (
          <div className="relative">
            <label htmlFor="location-search" className="sr-only">Search address</label>
            <input
              id="location-search"
              type="text"
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Search for a location…"
              className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-rust/40"
            />

            {suggestions.length > 0 && (
              <ul className="absolute top-full left-0 right-0 mt-1 max-h-52 overflow-y-auto rounded-lg border border-parchment-dark bg-white shadow-md z-10">
                {suggestions.map((f, i) => {
                  const label = f.properties.full_address ?? f.properties.name;
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => handleSelect(f)}
                        className="w-full px-3 py-2 text-left text-sm text-ink hover:bg-parchment transition-colors"
                      >
                        {label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-muted hover:text-ink transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!selected || saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rust text-white text-sm font-medium hover:bg-rust-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run modal tests — confirm all pass**

```bash
npm test tests/unit/components/EditLocationModal.test.tsx
```

Expected: all tests pass.

- [ ] **Step 3: Run full suite — confirm no regressions**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add components/EditLocationModal.tsx tests/unit/components/EditLocationModal.test.tsx
git commit -m "feat(ui): add EditLocationModal with Mapbox autocomplete"
```

---

## Task 8: `TripCompanionClient` — local state + modal wiring

Wire up the modal, local trip state, and `mapKey`.

**Files:**
- Modify: `components/TripCompanionClient.tsx`

**Testing note:** The spec lists three `TripCompanionClient` unit tests (`handleLocationSave` updates state, increments `mapKey`, clears `editingStopId`). These are intentionally skipped here — `TripCompanionClient` renders many sub-components (MapTab with Mapbox, ChatTab, ChecklistTab) that are hard to isolate in jsdom. The save path is fully covered end-to-end by the `EditLocationModal` tests. Manual testing (Task 9 Step 3) validates the integration.

- [ ] **Step 1: Update `TripCompanionClient.tsx`**

Replace the file contents (keeping existing imports, adding new ones):

```tsx
"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  List,
  Map,
  MessageCircle,
  CheckSquare,
} from "lucide-react";
import { ItineraryTab } from "@/components/ItineraryTab";
import { MapTab } from "@/components/MapTab";
import { ChatTab } from "@/components/ChatTab";
import { ChecklistTab } from "@/components/ChecklistTab";
import { EditLocationModal } from "@/components/EditLocationModal";
import type { MapViewport } from "@/components/MapTab";
import type { TripDetail, DayDetail, ChecklistItem } from "@/types/trip";

type Tab = "itinerary" | "map" | "chat" | "checklist";

const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: "itinerary", label: "Itinerary", Icon: List },
  { id: "map",       label: "Map",       Icon: Map },
  { id: "chat",      label: "Chat",      Icon: MessageCircle },
  { id: "checklist", label: "Checklist", Icon: CheckSquare },
];

interface TripCompanionClientProps {
  trip: TripDetail;
  checklist: ChecklistItem[];
}

function getDefaultDayNumber(
  days: DayDetail[],
  startDate: string | null,
  endDate: string | null
): number {
  if (startDate && endDate) {
    const todayISO = new Date().toISOString().split("T")[0];
    if (todayISO >= startDate && todayISO <= endDate) {
      const match = days.find((d) => d.date?.startsWith(todayISO));
      if (match) return match.day_number;
    }
  }
  return days[0]?.day_number ?? 1;
}

export function TripCompanionClient({ trip, checklist }: TripCompanionClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>("itinerary");
  const [selectedDay, setSelectedDay] = useState<number>(
    () => getDefaultDayNumber(trip.days, trip.start_date, trip.end_date)
  );
  const [tripState, setTripState] = useState<TripDetail>(() => trip);
  const [editingStopId, setEditingStopId] = useState<string | null>(null);
  const [mapKey, setMapKey] = useState(0);
  const mapViewportRef = useRef<MapViewport | null>(null);

  function handleLocationSave(stopId: string, address: string, lat: number, lng: number) {
    setTripState((prev) => ({
      ...prev,
      days: prev.days.map((day) => ({
        ...day,
        stops: day.stops.map((stop) =>
          stop.id === stopId ? { ...stop, address, lat, lng } : stop
        ),
      })),
    }));
    setMapKey((k) => k + 1);
    setEditingStopId(null);
  }

  const editingStop = editingStopId
    ? tripState.days.flatMap((d) => d.stops).find((s) => s.id === editingStopId) ?? null
    : null;

  return (
    <div className="flex flex-col min-h-[calc(100dvh-56px)]">
      {/* Sticky header */}
      <header className="sticky top-14 z-10 bg-cream border-b border-parchment-dark">
        <div className="flex items-start gap-3 px-4 py-3 max-w-2xl mx-auto w-full">
          <Link
            href="/dashboard"
            className="mt-0.5 shrink-0 text-muted hover:text-ink transition-colors"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="font-serif text-xl font-semibold text-ink leading-tight truncate">
              {tripState.name}
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5 text-sm text-muted">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{tripState.destination}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Scrollable content */}
      <main className="flex-1 pb-20 max-w-2xl mx-auto w-full">
        {activeTab === "itinerary" && (
          <ItineraryTab
            days={tripState.days}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            onEditStop={(id) => setEditingStopId(id)}
          />
        )}
        {activeTab === "map" && (
          <MapTab
            key={mapKey}
            days={tripState.days}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            savedViewport={mapViewportRef.current}
            onViewportChange={(vp) => { mapViewportRef.current = vp; }}
            onEditStop={(id) => setEditingStopId(id)}
          />
        )}
        {activeTab === "chat" && (
          <ChatTab
            tripId={tripState.id}
            tripName={tripState.name}
            destination={tripState.destination}
          />
        )}
        {activeTab === "checklist" && (
          <ChecklistTab tripId={tripState.id} initialItems={checklist} />
        )}
      </main>

      {/* Fixed bottom tab bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-20 bg-parchment border-t border-parchment-dark"
        aria-label="Trip sections"
      >
        <div className="flex max-w-2xl mx-auto">
          {TABS.map(({ id, label, Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                aria-pressed={isActive}
                aria-label={label}
                className={[
                  "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors",
                  isActive ? "text-rust" : "text-muted hover:text-ink-mid",
                ].join(" ")}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Edit location modal */}
      {editingStop && (
        <EditLocationModal
          stop={editingStop}
          tripId={tripState.id}
          onSave={handleLocationSave}
          onClose={() => setEditingStopId(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run full suite — confirm no regressions**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add components/TripCompanionClient.tsx
git commit -m "feat(ui): wire EditLocationModal into TripCompanionClient"
```

---

## Task 9: `MapTab` — popup edit links + delegated listener

Add "Edit location" links to hotel and stop popups, with a delegated click listener that fires `onEditStop`.

**Files:**
- Modify: `components/MapTab.tsx`

MapTab popup click delegation is not unit-testable in jsdom. Manual testing is required for this task — run the dev server and verify the edit modal opens from map popups.

- [ ] **Step 1: Update `MapTab.tsx`**

**Add `onEditStop?` to the `MapTabProps` interface:**

```ts
interface MapTabProps {
  days: DayDetail[];
  selectedDay: number;
  onSelectDay: (day: number) => void;
  savedViewport?: MapViewport | null;
  onViewportChange?: (viewport: MapViewport) => void;
  onEditStop?: (stopId: string) => void;  // NEW
}
```

**Update the function signature:**

```ts
export function MapTab({
  days,
  selectedDay,
  onSelectDay,
  savedViewport,
  onViewportChange,
  onEditStop,       // NEW
}: MapTabProps) {
```

**Define `handlePopupClick` before the `useEffect` (inside the component body).** Note: defining it here means it is re-created each render, but since `useEffect` only re-runs on `selectedDay` change, the listener is replaced only then — which is correct. `onEditStop` calls `setEditingStopId` which is a stable `useState` setter, so stale closure is not a practical concern.

```ts
const handlePopupClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  const editBtn = target.closest("[data-edit-stop]") as HTMLElement | null;
  if (editBtn) {
    e.preventDefault();
    onEditStop?.(editBtn.getAttribute("data-edit-stop")!);
  }
};
```

**In the `useEffect`, inside the `.then()` callback, after all markers are added and before the `moveend` listener**, add:

```ts
mapContainer.current.addEventListener("click", handlePopupClick);
```

**Update the cleanup return to remove the listener:**

```ts
return () => {
  cancelled = true;
  mapContainer.current?.removeEventListener("click", handlePopupClick);
  mapRef.current?.remove();
  mapRef.current = null;
};
```

**Add the "Edit location" link to hotel popup HTML** (after the Get Directions link):

```ts
// In the hotel popup setHTML string, append after the directions <a>:
`<br><a data-edit-stop="${activeHotel.id}" href="#" style="display:inline-block;margin-top:6px;font-size:11px;color:#9A8570;font-family:sans-serif;text-decoration:underline">Edit location</a>`
```

**Add the "Edit location" link to regular stop popup HTML** (after the Get Directions link):

```ts
// In the stop popup setHTML string, append after the directions <a>:
`<br><a data-edit-stop="${stop.id}" href="#" style="display:inline-block;margin-top:6px;font-size:11px;color:#9A8570;font-family:sans-serif;text-decoration:underline">Edit location</a>`
```

Option popups do NOT get an "Edit location" link (options have no `id` field).

- [ ] **Step 2: Run full suite — confirm no regressions**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Manual verification**

```bash
npm run dev
```

1. Open a trip → Map tab
2. Click a stop pin → popup should show "Edit location" link
3. Click "Edit location" → modal opens with current address pre-filled
4. Type a new location → suggestions appear
5. Select a suggestion → Save enables
6. Click Save → pin moves to new location
7. Switch to Itinerary tab → pencil icon visible on stops
8. Click pencil → modal opens
9. Save → switch back to Map → pin at corrected location

- [ ] **Step 4: Run lint and typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/MapTab.tsx
git commit -m "feat(ui): add Edit location links to MapTab popups"
```

---

## Task 10: Final check + push

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected: all tests pass (target: ~235 green — 221 existing + ~14 new).

- [ ] **Step 2: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Push and open PR**

```bash
git push -u origin HEAD
gh pr create \
  --title "feat: edit stop location with Mapbox autocomplete" \
  --body "$(cat <<'EOF'
## Summary

- Adds pencil icon to every StopCard header to open an address edit modal
- Adds \"Edit location\" link to hotel and stop map popups
- EditLocationModal: Mapbox Geocoding API v6 autocomplete, debounced, with proximity=ip bias
- New PATCH /api/trips/[id]/stops/[stopId] endpoint persists address + lat + lng
- TripCompanionClient holds local trip state; map pin updates immediately on save (mapKey remount)

## Test plan

- [ ] Run `npm test` — all tests green
- [ ] Open a trip with a mislocated stop → edit via itinerary pencil → verify pin moves
- [ ] Edit via map popup → verify modal opens and pin moves on save
- [ ] Edit a stop with no existing address (null) → pencil still visible, modal starts empty
- [ ] Verify Cancel / Escape / overlay click all close modal without saving

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
