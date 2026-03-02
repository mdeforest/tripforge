# TripForge — Product Requirements Document

## 1. Executive Summary

TripForge is a web application that transforms a traveler's existing itinerary into a personalized, AI-powered travel companion app. Users upload their itinerary (PDF, Word doc, plain text, or Google Docs link), and TripForge parses it with AI to generate a custom experience — a browsable day-by-day view, an interactive map, an AI chat assistant that knows their trip, a packing checklist, and offline access. It's designed for independent travelers who plan their own trips but want a polished, app-like experience to use on the go.

---

## 2. Problem Statement

Self-planners invest significant time building detailed itineraries in documents, spreadsheets, or notes — but those formats are clunky to navigate mid-trip. Dedicated travel apps like TripIt require you to book through specific channels or manually re-enter everything. TripForge bridges the gap: bring your own itinerary, get a beautiful app experience.

---

## 3. Goals & Success Criteria

**Primary goals:**
- A user can upload any common itinerary document and get a parsed, browsable trip experience within 60 seconds.
- The trip companion is useful and intuitive to navigate on a mobile browser without installing anything.
- The AI chat assistant can answer reasonable questions about the trip using the parsed itinerary as context.
- Trips persist across sessions for logged-in users.

**Success for v1 (personal project):**
- End-to-end flow works reliably for the creator's own trips.
- Parsing handles a variety of real-world itinerary formats and layouts.
- Offline access works for the itinerary browser and checklist.

**Out of scope for v1:**
- Native mobile app (iOS/Android)
- Collaborative/shared trips
- Direct booking integrations (flights, hotels)
- Push notifications
- Social features

---

## 4. Target Users

**Persona: The Independent Planner**
- Who they are: A traveler (age 25–45) who loves researching and planning their own trips in detail — using Google Docs, Notion, or Word to build itineraries.
- What they need: A way to use their existing itinerary as a smart, interactive travel companion without re-entering data.
- Pain points: Their itinerary doc is hard to navigate on mobile; switching between maps, docs, and weather apps is fragmented; no single "home base" for the trip.

---

## 5. User Stories

### Onboarding & Auth
- As a new user, I want to sign up with email/password or Google so I can save my trips.
- As a returning user, I want to log in and see all my saved trips on a dashboard.

**Acceptance criteria:** Auth flow completes in under 3 steps. Dashboard loads trips within 1 second.

### Itinerary Upload & Parsing
- As a user, I want to upload a PDF, Word doc, or paste plain text so I don't have to re-enter my itinerary.
- As a user, I want to provide a Google Docs link so the app can pull my itinerary directly.
- As a user, I want to see a loading indicator while the AI parses my document so I know it's working.
- As a user, I want to review and confirm the parsed trip summary before the companion app is generated, so I can catch major parsing errors.

**Acceptance criteria:** Parsing completes within 30 seconds for a typical 7-day itinerary. Parsed output shows trip name, dates, destinations, and a list of days/stops for review.

### Trip Companion — Itinerary Browser
- As a user, I want to browse my itinerary day-by-day so I can easily see what's planned each day.
- As a user, I want to tap on a stop to see its details (name, address, notes, time).
- As a user, I want to navigate between days with simple prev/next controls.

**Acceptance criteria:** All days and stops from the itinerary are displayed. Tapping a stop shows full details. Navigation is usable with one thumb on mobile.

### Trip Companion — Maps
- As a user, I want to see each stop on a map so I know where I'm going.
- As a user, I want to tap a stop to get directions to it.

**Acceptance criteria:** All stops with parseable addresses are displayed on a map. Tapping a stop opens directions in Google Maps or Apple Maps.

### Trip Companion — AI Chat Assistant
- As a user, I want to ask questions about my trip in natural language (e.g., "What are we doing on Tuesday?", "How long is the drive from Florence to Siena?") and get helpful answers.
- As a user, I want the AI to have full context of my itinerary so I don't have to re-explain my trip.

**Acceptance criteria:** The assistant responds within 5 seconds. It correctly answers factual questions about the itinerary. It gracefully handles questions outside its knowledge.

### Trip Companion — Packing Checklist
- As a user, I want a packing checklist that the AI pre-populates based on my trip (destination, duration, activities).
- As a user, I want to check off items and add custom items.
- As a user, I want my checklist progress to be saved.

**Acceptance criteria:** AI generates a relevant initial list (15–30 items). Items can be checked/unchecked and persist across sessions. Custom items can be added and deleted.

### Offline Access
- As a user, I want to access my itinerary browser and checklist without an internet connection so I can use the app while traveling.

**Acceptance criteria:** Itinerary browser and checklist are accessible offline after the trip has been loaded once. Map tiles cache for recent views. AI chat requires internet.

---

## 6. Feature Specification

### Feature 1: Itinerary Upload & AI Parsing

**Description:** The entry point to creating a trip. User provides their itinerary in one of four formats; the app extracts structured data using the Claude API.

**User flow:**
1. User clicks "New Trip" from dashboard.
2. User selects input method: upload file (PDF/DOCX), paste text, or enter Google Docs URL.
3. File/text is sent to the backend, which calls the Claude API with a structured extraction prompt.
4. Claude returns structured JSON: trip name, destination(s), start/end dates, and an array of days each containing stops with name, time, address, type (hotel/restaurant/activity), and notes.
5. User sees a "Review Your Trip" screen showing the parsed summary.
6. User confirms → trip is saved to DB and companion app is generated.

**Parsing prompt strategy:** The backend sends the raw document text with a detailed system prompt instructing Claude to extract structured itinerary data and return valid JSON. Fallbacks handle missing fields gracefully (e.g., no address → stop still shown without map pin).

**Edge cases:**
- Unreadable PDF (scanned image) → show error: "We couldn't read this PDF. Try copy-pasting the text instead."
- Google Docs link without public access → show error with instructions to enable link sharing.
- Parsing returns incomplete data → allow user to proceed with partial data or re-upload.

---

### Feature 2: Day-by-Day Itinerary Browser

**Description:** The main view of the travel companion — a mobile-optimized, scrollable day view.

**User flow:**
1. User opens their trip from the dashboard.
2. Defaults to current day (or Day 1 if trip hasn't started).
3. User sees a timeline of stops for the day with time, name, type icon, and short notes.
4. User can tap a stop to expand full details.
5. Prev/Next buttons navigate between days; a day picker allows jumping.

**UI notes:** Card-based layout with warm colors and subtle maps/destination photography. Each stop type (hotel, food, activity, transport) has a distinct icon.

---

### Feature 3: Maps & Directions

**Description:** An embedded map view showing all stops for the selected day.

**User flow:**
1. From the day view, user taps "Map" tab.
2. Stops for that day are shown as numbered pins on a map.
3. Tapping a pin shows a popup with the stop name and a "Get Directions" button.
4. "Get Directions" opens the native maps app (Google Maps on Android, Apple Maps on iOS, Google Maps on desktop).

**Implementation:** Google Maps JavaScript API (or Mapbox as alternative). Only stops with valid addresses get pins. *Recommendation: use Mapbox for better pricing at low volume.*

---

### Feature 4: AI Chat Assistant

**Description:** A chat interface where the user can ask questions about their trip.

**User flow:**
1. User taps "Ask AI" tab in the companion.
2. Chat interface appears with a welcome message.
3. User types a question; response streams in.
4. Conversation history persists for the session.

**Implementation:** Claude API with the full parsed itinerary injected into the system prompt. Streaming responses for snappy UX.

**Edge cases:** If Claude can't answer from the itinerary, it responds with what it knows generally (e.g., general info about a destination) and notes that it's not from the itinerary.

---

### Feature 5: Packing Checklist

**Description:** A smart checklist pre-populated by AI based on the trip, with full customization.

**User flow:**
1. When trip is created, the backend calls Claude to generate a packing list JSON based on trip details.
2. User sees the list organized by category (Clothing, Documents, Tech, Toiletries, etc.).
3. User checks off items as they pack; state is saved to DB.
4. User can add custom items and delete any item.

---

### Feature 6: Offline Access

**Description:** Core read-only features work without internet.

**Implementation:** Next.js PWA with service worker (using `next-pwa`). Cache the itinerary JSON and checklist state in IndexedDB. Cache map tiles for recently viewed areas. AI chat and new data syncs when connection is restored.

---

## 7. Information Architecture

**Pages:**
- `/` — Landing page / marketing
- `/login` — Login (email or Google)
- `/signup` — Sign up
- `/dashboard` — List of user's trips
- `/trips/new` — Upload itinerary flow
- `/trips/[id]` — Trip companion app (tabs: Itinerary, Map, Chat, Checklist)
- `/trips/[id]/review` — Review parsed itinerary before confirming

**Navigation inside trip companion:**
- Bottom tab bar (mobile-style): Itinerary | Map | Chat | Checklist
- Top bar: Trip name, current day indicator, back to dashboard

---

## 8. Data Model

### Users
| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| email | string | Unique |
| password_hash | string | Nullable (null if OAuth only) |
| google_id | string | Nullable |
| name | string | |
| created_at | timestamp | |

### Trips
| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| user_id | UUID | FK → Users |
| name | string | e.g., "Italy 2025" |
| destination | string | Primary destination |
| start_date | date | |
| end_date | date | |
| raw_input | text | Original document text |
| parsed_data | JSONB | Full structured itinerary |
| packing_list | JSONB | AI-generated + user edits |
| created_at | timestamp | |

### Days (normalized from parsed_data for querying)
| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| trip_id | UUID | FK → Trips |
| day_number | integer | 1-indexed |
| date | date | Nullable |
| title | string | e.g., "Arrival in Rome" |

### Stops
| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| day_id | UUID | FK → Days |
| name | string | |
| type | enum | hotel, restaurant, activity, transport, other |
| time | string | e.g., "10:30 AM" — stored as string for flexibility |
| address | string | Nullable |
| lat | float | Nullable — geocoded |
| lng | float | Nullable — geocoded |
| notes | text | Nullable |
| order | integer | Display order within day |

### ChecklistItems
| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| trip_id | UUID | FK → Trips |
| category | string | e.g., "Clothing" |
| label | string | e.g., "Rain jacket" |
| checked | boolean | Default false |
| is_custom | boolean | User-added vs AI-generated |

---

## 9. Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 14 (App Router) | Full-stack React, great for SSR + API routes, excellent Vercel integration |
| Language | TypeScript | Type safety for complex data structures (itinerary JSON) |
| Database | PostgreSQL (via Supabase) | Reliable relational DB with JSONB support; Supabase gives free tier + auth helpers |
| ORM | Prisma | Type-safe DB queries, great DX, easy migrations |
| Auth | NextAuth.js | Handles both email/password and Google OAuth cleanly |
| AI | Anthropic Claude API | Itinerary parsing + chat assistant |
| Maps | Mapbox GL JS | Better free tier than Google Maps for personal projects |
| Styling | Tailwind CSS | Rapid UI development |
| PWA / Offline | next-pwa + Workbox | Service worker generation for offline support |
| Hosting | Vercel | Zero-config Next.js deployment |
| File parsing | pdf-parse (PDF), mammoth (DOCX) | Extract text from uploaded files server-side |

---

## 10. API Contracts

### Auth
**POST /api/auth/signup**
```
Request: { email: string, password: string, name: string }
Response: { user: User, token: string }
Errors: 400 (validation), 409 (email exists)
```

### Trips
**GET /api/trips**
```
Auth: required
Response: { trips: Trip[] }
```

**POST /api/trips/parse**
```
Auth: required
Request: multipart/form-data { file?: File, text?: string, googleDocsUrl?: string }
Response: { parsedData: ParsedItinerary, rawText: string }
Errors: 400 (no input), 422 (parse failed), 504 (AI timeout)
```

**POST /api/trips**
```
Auth: required
Request: { name: string, parsedData: ParsedItinerary, rawText: string }
Response: { trip: Trip }
```

**GET /api/trips/[id]**
```
Auth: required (owner only)
Response: { trip: Trip, days: Day[], stops: Stop[], checklistItems: ChecklistItem[] }
```

**DELETE /api/trips/[id]**
```
Auth: required (owner only)
Response: { success: true }
```

### Checklist
**PATCH /api/trips/[id]/checklist**
```
Auth: required
Request: { items: { id: string, checked: boolean }[] }
Response: { items: ChecklistItem[] }
```

**POST /api/trips/[id]/checklist**
```
Auth: required
Request: { label: string, category: string }
Response: { item: ChecklistItem }
```

**DELETE /api/trips/[id]/checklist/[itemId]**
```
Auth: required
Response: { success: true }
```

### AI Chat
**POST /api/trips/[id]/chat**
```
Auth: required
Request: { messages: { role: "user" | "assistant", content: string }[] }
Response: streaming text/event-stream
```

---

## 11. Authentication & Authorization

- **Auth method:** NextAuth.js with two providers: Credentials (email/password with bcrypt hashing) and Google OAuth.
- **Sessions:** JWT-based sessions stored in httpOnly cookies. 30-day session duration.
- **Authorization:** All trip data is scoped to the authenticated user. API routes validate that `trip.user_id === session.user.id` before returning data.
- **Google OAuth setup:** Requires a Google Cloud project with OAuth 2.0 credentials. *User will need to configure this manually.*

---

## 12. Non-Functional Requirements

- **Performance:** Itinerary parsing should complete within 30 seconds. Page loads under 2 seconds on a 4G connection. Chat responses start streaming within 3 seconds.
- **Mobile-first:** All UI designed for 375px+ screen widths. Bottom navigation for thumb reach. Large touch targets (min 44px).
- **Offline:** Itinerary browser and checklist available offline via PWA service worker. Clear "You're offline" indicator in chat tab.
- **Security:** No raw passwords stored. Google Docs fetching uses server-side proxy (never exposes API keys to client). File uploads validated for type and size (max 10MB).
- **Accessibility:** Semantic HTML, keyboard navigable, sufficient color contrast.
- **Scale:** Designed for single-user personal use. Supabase free tier supports ~500MB DB and 2GB bandwidth — sufficient for personal use.

---

## 13. Edge Cases & Error Handling

- **Parsing fails / incomplete:** User is shown what was parsed and given the option to re-upload or proceed with partial data.
- **Google Docs not public:** Error message with instructions on enabling link sharing.
- **Scanned/image PDF:** `pdf-parse` will return empty text. Show specific error with fallback to paste text.
- **AI chat offline:** Tab shows "Chat requires an internet connection."
- **Stop has no address:** Stop is shown in itinerary but omitted from map view with no error.
- **Trip with no dates:** App gracefully handles undated itineraries by showing "Day 1, Day 2..." labels.
- **Session expiry:** User is redirected to login with a friendly message.
- **Claude API rate limit / timeout:** Show error toast: "The AI is taking longer than expected. Try again in a moment."

---

## 14. Testing Strategy

### Philosophy
Tests exist to catch regressions, document behaviour, and give confidence to refactor. Every feature built in Phases 2–9 ships with tests.

### Framework
| Tool | Purpose |
|---|---|
| **Vitest** | Unit and integration test runner (fast, ESM-native, TypeScript-first) |
| **React Testing Library** | Component tests — interactions from the user's perspective |
| **jsdom** | Browser-like DOM environment for component tests |
| **Playwright** | End-to-end tests (Phase 9 only) |

### Test types & coverage targets

**Unit tests** — isolated functions, API route handlers (Prisma mocked)
- All API routes: happy path + validation errors + auth errors + DB errors
- All utility functions (geocode, buildSystemPrompt, parseItinerary, rateLimit, offlineCache)
- Target: **≥ 80% line coverage** on `lib/` and `app/api/`

**Component tests** — React Testing Library rendering and interaction
- Every reusable component in `components/`
- Key behaviours: renders correctly, handles user events, conditional states (loading, empty, error)
- Target: **≥ 70% line coverage** on `components/`

**End-to-end tests** — Playwright, added in Phase 9
- Full happy path: sign up → upload itinerary → review → confirm → view companion → check packing list
- Run against a staging environment before production deploy

### Test file locations
```
tests/
  setup.ts                    ← global mocks (Prisma, NextAuth, next/navigation)
  unit/
    api/                      ← one file per API route
    components/               ← one file per component
    lib/                      ← one file per utility module
  e2e/                        ← Playwright tests (Phase 9)
```

### Running tests
```bash
npm test              # run all tests (CI)
npm run test:watch    # watch mode during development
npm run test:coverage # generate HTML + lcov coverage report
```

### Mocking strategy
- **Prisma** — mocked globally in `tests/setup.ts`; individual tests override per-method return values with `vi.mocked(prisma.model.method).mockResolvedValue(...)`
- **NextAuth** — `useSession` mocked globally; tests set authenticated state via `vi.mocked(useSession).mockReturnValue(...)`
- **Anthropic / Mapbox APIs** — mocked at the fetch level using `vi.stubGlobal("fetch", ...)` in relevant test files
- **Mapbox GL JS** — cannot render WebGL in jsdom; mock the entire module

---

## 15. Future Considerations (Post-v1)

- **Sharing:** Generate a public read-only link to share a trip with travel companions.
- **Native app:** React Native version using the same backend.
- **Real-time collaboration:** Multiple users editing/viewing a trip together.
- **Flight/hotel status:** Integrate with airline/hotel APIs to show live status updates.
- **Photo journal:** Let users attach photos to stops during the trip.
- **Export:** Re-export the parsed itinerary as a clean PDF.
- **Multi-language UI:** Internationalization for non-English users.
- **Booking integrations:** TripIt, Google Travel, or direct email parsing for automatic itinerary import.
