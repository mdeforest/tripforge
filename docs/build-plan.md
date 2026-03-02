# TripForge — Claude Code Build Plan

## Overview

Build a Next.js 14 web app that transforms uploaded itineraries into AI-powered travel companion experiences. The stack is: Next.js + TypeScript + PostgreSQL (Supabase) + Prisma + NextAuth + Claude API + Mapbox + Tailwind CSS, deployed to Vercel.

---

## Testing Strategy

**Framework:** Vitest + React Testing Library (unit/integration) · Playwright (E2E, Phase 9)

**Conventions:**
- All tests live in `tests/` mirroring the source structure (`tests/unit/api/`, `tests/unit/components/`, `tests/unit/lib/`, `tests/integration/`)
- Global mocks (Prisma, NextAuth, next/navigation) are defined in `tests/setup.ts`
- Every API route must have unit tests covering: happy path, validation errors, auth errors, and DB errors
- Every reusable component must have tests covering: renders correctly, user interactions, and conditional states
- New utility functions require JSDoc + unit tests before merging
- Run `npm test` before every phase sign-off; all tests must pass green

**Scripts:**
```bash
npm test              # run all tests once (CI mode)
npm run test:watch    # watch mode for development
npm run test:coverage # generate coverage report
```

---

## Development Phases

### Phase 1: Project Setup & Foundation ✅

**Goal:** Working Next.js app with DB, auth scaffolding, and base layout.

Tasks:
- Initialize Next.js 14 project with TypeScript and App Router
- Set up Tailwind CSS with a warm, Airbnb-inspired design system (earthy tones, rounded corners, generous spacing).
- Use tripforge-prototype.jsx as the visual reference for all UI — match the colors, fonts, and component styles exactly.
- Configure Prisma with PostgreSQL connection (Supabase)
- Create all DB schema migrations (Users, Trips, Days, Stops, ChecklistItems)
- Set up NextAuth.js with Google OAuth + Credentials providers
- Create base layout with authenticated route guards
- Create `.env.example` with all required env vars
- Set up base error boundary and loading states
- Set up Vitest + React Testing Library testing framework

**Tests (Phase 1):**
- `tests/unit/api/signup.test.ts` — POST /api/auth/signup (7 cases)
- `tests/unit/lib/prisma.test.ts` — Prisma singleton (3 cases)
- `tests/unit/components/NavBar.test.tsx` — NavBar component (8 cases)

**Env vars needed:**
```
DATABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ANTHROPIC_API_KEY=
MAPBOX_ACCESS_TOKEN=
```

---

### Phase 2: Auth Flow

**Goal:** Working sign up, login, and dashboard.

Tasks:
- Sign up page (email/password)
- Login page (email/password + Google OAuth button)
- Protected dashboard page (redirects to login if not authed)
- Empty state dashboard ("No trips yet — create your first one")
- Trip card component (shows trip name, destination, dates)
- User avatar / logout in nav

**Tests (Phase 2):**
- `tests/unit/components/SignUpForm.test.tsx` — form validation, submit, error states
- `tests/unit/components/LoginForm.test.tsx` — form validation, submit, Google button, error states
- `tests/unit/components/TripCard.test.tsx` — renders trip name, destination, dates; handles missing dates
- `tests/unit/components/Dashboard.test.tsx` — empty state, list state
- Integration: sign-up → sign-in flow with mocked DB

---

### Phase 3: Itinerary Upload & AI Parsing

**Goal:** Users can upload an itinerary and get structured data back from Claude.

Tasks:
- "New Trip" upload page with 3 input modes: file upload, paste text, Google Docs URL
- Server-side file parsing:
  - PDF: `pdf-parse` library
  - DOCX: `mammoth` library
  - Google Docs: server-side fetch of public doc export URL
- `/api/trips/parse` endpoint that:
  1. Extracts raw text from the input
  2. Calls Claude API with structured extraction prompt
  3. Returns parsed itinerary JSON
- Claude parsing prompt (see prompt below)
- "Review Your Trip" page showing parsed summary (trip name, dates, destination, day count, stop count)
- Confirm → saves trip to DB (creates Trip, Days, Stops rows)
- Error states for unreadable files, failed parsing

**Tests (Phase 3):**
- `tests/unit/api/trips-parse.test.ts` — parse endpoint: text input, file input, Google Docs URL, Claude timeout, malformed Claude response, empty text
- `tests/unit/api/trips-create.test.ts` — create trip: success, missing fields, auth guard
- `tests/unit/lib/parseItinerary.test.ts` — Claude response parsing utility: valid JSON, invalid JSON, missing fields
- `tests/unit/components/UploadForm.test.tsx` — tab switching, file drag-and-drop, URL input, submit states
- `tests/unit/components/ReviewTrip.test.tsx` — renders parsed summary, confirm button, back button

**Claude parsing prompt template:**
```
You are an expert travel itinerary parser. Extract structured data from the following itinerary document and return ONLY valid JSON in this exact format:

{
  "tripName": "string",
  "destination": "string (primary destination)",
  "startDate": "YYYY-MM-DD or null",
  "endDate": "YYYY-MM-DD or null",
  "days": [
    {
      "dayNumber": 1,
      "date": "YYYY-MM-DD or null",
      "title": "string",
      "stops": [
        {
          "name": "string",
          "type": "hotel | restaurant | activity | transport | other",
          "time": "string or null",
          "address": "string or null",
          "notes": "string or null",
          "order": 1
        }
      ]
    }
  ]
}

Return only the JSON object. No explanations. No markdown.

ITINERARY:
{rawText}
```

---

### Phase 4: Trip Companion — Itinerary Browser

**Goal:** The core trip companion experience — browsable day-by-day itinerary.

Tasks:
- Trip companion layout with bottom tab bar: Itinerary | Map | Chat | Checklist
- Itinerary tab:
  - Day selector (pill buttons or horizontal scroll)
  - Timeline of stops for selected day
  - Stop card component: icon by type, name, time, short notes
  - Expandable stop detail panel (full address, notes, "Get Directions" link)
  - Default to current day if within trip dates, otherwise Day 1
- Stop type icons (use Lucide React icons)

**Tests (Phase 4):**
- `tests/unit/components/DaySelector.test.tsx` — renders day pills, active state, click navigation
- `tests/unit/components/StopCard.test.tsx` — renders each stop type with correct icon, expand/collapse, "Get Directions" link
- `tests/unit/components/ItineraryTab.test.tsx` — defaults to Day 1, navigates between days, handles empty days
- `tests/unit/api/trips-get.test.ts` — GET /api/trips/[id]: returns trip+days+stops, 404 for missing, 403 for wrong user

---

### Phase 5: Trip Companion — Maps

**Goal:** Map view showing stops for the selected day with directions.

Tasks:
- Integrate Mapbox GL JS
- Map tab showing pins for all stops on selected day that have addresses
- Geocode addresses server-side using Mapbox Geocoding API (on trip creation)
- Store lat/lng on Stop rows in DB
- Numbered pins matching stop order
- Tap pin → popup with stop name + "Get Directions" button
- "Get Directions" links to `https://maps.google.com/?q={address}` (works on all platforms)
- Graceful handling of stops with no geocodable address

**Tests (Phase 5):**
- `tests/unit/lib/geocode.test.ts` — geocodeAddress utility: success, Mapbox error, no results, null address input
- `tests/unit/components/MapTab.test.tsx` — renders with stops, handles stops without coordinates, "Get Directions" href format
- Mapbox GL JS is mocked in tests (cannot render WebGL in jsdom)

---

### Phase 6: Trip Companion — AI Chat

**Goal:** Streaming AI chat assistant with full trip context.

Tasks:
- Chat tab with message list and input
- `/api/trips/[id]/chat` streaming endpoint
- System prompt includes full serialized trip itinerary
- Streaming response using Vercel AI SDK (`ai` package) + Anthropic provider
- Session-scoped conversation history (in-memory / React state, not persisted)
- Welcome message with suggested questions
- Loading indicator while streaming
- "Offline" state detected via `navigator.onLine`

**Tests (Phase 6):**
- `tests/unit/api/chat.test.ts` — chat endpoint: auth guard, trip ownership check, message format validation, Claude error handling
- `tests/unit/components/ChatTab.test.tsx` — renders welcome message, sends message, shows loading indicator, offline banner
- `tests/unit/lib/buildSystemPrompt.test.ts` — system prompt utility: includes trip name, destination, all days/stops

---

### Phase 7: Trip Companion — Packing Checklist

**Goal:** Smart packing list pre-generated by AI, fully editable.

Tasks:
- On trip creation (after confirm), call Claude to generate packing list JSON
- Packing list generation prompt uses trip name, destination, duration, and stop types
- Store as ChecklistItems rows in DB
- Checklist tab: items grouped by category with checkboxes
- Optimistic UI for check/uncheck (PATCH API call in background)
- Add custom item (input + "Add" button)
- Delete item (swipe or X button)
- Progress indicator: "12 of 24 packed"

**Tests (Phase 7):**
- `tests/unit/api/checklist-patch.test.ts` — PATCH /api/trips/[id]/checklist: updates checked state, auth guard, invalid item IDs
- `tests/unit/api/checklist-post.test.ts` — POST: creates custom item, validates label/category
- `tests/unit/api/checklist-delete.test.ts` — DELETE: removes item, auth guard
- `tests/unit/components/ChecklistTab.test.tsx` — groups by category, check/uncheck (optimistic UI), add item, delete item, progress indicator

---

### Phase 8: Offline Support (PWA)

**Goal:** Itinerary and checklist work without internet.

Tasks:
- Install and configure `next-pwa`
- Add `manifest.json` with app name, icons, theme color
- Service worker caches: itinerary page, static assets, fonts
- Store itinerary data in IndexedDB (using `idb` library) on first load
- Serve cached itinerary data when offline
- Checklist state also cached in IndexedDB with sync on reconnect
- "You're offline" banner in chat tab
- Test offline behavior in Chrome DevTools

**Tests (Phase 8):**
- `tests/unit/lib/offlineCache.test.ts` — IndexedDB read/write/clear with idb mocked
- `tests/unit/components/OfflineBanner.test.tsx` — shown when navigator.onLine is false, hidden when online
- Manual test: Chrome DevTools → Network → Offline → verify itinerary + checklist load

---

### Phase 9: Polish & Deployment

**Goal:** Production-ready, visually polished, deployed.

Tasks:
- Responsive design pass — test on 375px, 390px, 768px, 1280px
- Loading skeletons for all async states
- Empty states with illustrations or icons
- Error toasts for failed API calls
- Page transitions (subtle fade)
- Favicon, OG image, page titles
- Rate limit Claude API calls (simple in-memory rate limit on chat endpoint)
- Set up Vercel project, connect GitHub repo
- Configure production env vars in Vercel dashboard
- Set up Supabase production DB
- Final end-to-end test with a real itinerary document

**Tests (Phase 9):**
- `tests/unit/components/Skeleton.test.tsx` — skeleton renders at correct dimensions
- `tests/unit/lib/rateLimit.test.ts` — rate limiter: allows requests under limit, blocks over limit, resets after window
- E2E (Playwright): full flow — sign up → upload itinerary → review → confirm → view companion → chat → checklist

---

## Manual Setup Required

The following require manual setup outside of code:

1. **Supabase project** — Create at supabase.com, get `DATABASE_URL`
2. **Google OAuth** — Create OAuth 2.0 credentials at console.cloud.google.com. Add `http://localhost:3000/api/auth/callback/google` (dev) and your production URL as redirect URIs.
3. **Anthropic API key** — Get at console.anthropic.com
4. **Mapbox access token** — Get at account.mapbox.com
5. **Vercel account** — Connect GitHub repo for deployment

---

## Claude Code Kick-Off Prompt

Copy and paste this into Claude Code, with the PRD attached as context:

---

```
I'm building TripForge — a web app that transforms uploaded travel itineraries into AI-powered travel companion experiences.

I have a PRD attached that describes the full spec. Please read it carefully before starting.

Let's start with Phase 1 of the build plan:

1. Initialize a new Next.js 14 project with TypeScript, App Router, and Tailwind CSS
2. Set up a warm, Airbnb-inspired design system in Tailwind config (earthy/warm color palette, rounded-xl corners, generous spacing scale)
3. Configure Prisma with PostgreSQL and create the full DB schema:
   - Users (id, email, password_hash, google_id, name, created_at)
   - Trips (id, user_id, name, destination, start_date, end_date, raw_input, parsed_data JSONB, packing_list JSONB, created_at)
   - Days (id, trip_id, day_number, date, title)
   - Stops (id, day_id, name, type enum, time, address, lat, lng, notes, order)
   - ChecklistItems (id, trip_id, category, label, checked, is_custom)
4. Set up NextAuth.js with Credentials and Google OAuth providers
5. Create a base app layout with:
   - A top nav bar (logo left, user avatar/logout right)
   - Protected route middleware (redirect to /login if not authenticated)
   - A loading.tsx and error.tsx for the root layout
6. Create a .env.example with all required environment variables:
   DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ANTHROPIC_API_KEY, MAPBOX_ACCESS_TOKEN
7. Set up the Vitest + React Testing Library testing framework

Technical guidelines:
- TypeScript strict mode
- Use Prisma Client as the sole DB access layer
- Use Next.js App Router conventions (server components by default, 'use client' only when needed)
- Tailwind for all styling — no CSS modules or styled-components
- Use Lucide React for icons
- Add clear JSDoc comments for all utility functions
- All API routes should return consistent error shapes: { error: string, code: string }
- Every API route and reusable component must have unit tests

After completing Phase 1, stop and show me a summary of what was created, the folder structure, and any decisions you made. I'll review before we move to Phase 2.
```
