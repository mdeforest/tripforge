# TripForge — Project Context

## Docs
Use the files in docs/ for additional context. 

## Stack
- Next.js 14 App Router · TypeScript strict · Tailwind CSS
- Prisma v5.22 (NOT v7) · PostgreSQL (Supabase)
- NextAuth v4 · `@auth/prisma-adapter` · JWT sessions (not DB sessions)
- bcryptjs · zod · Lucide React · Anthropic Claude SDK

## Commands
```
npm run dev          # dev server
npm test             # vitest CI
npm run test:watch   # vitest watch
npm run test:coverage
npx prisma db push   # sync schema
npx prisma studio    # DB GUI
```

## Architecture
- Route groups: `(app)/` = auth-required + NavBar; `(auth)/` = login/signup
- Server components query Prisma directly; never call their own API routes
- `lib/auth.ts` exports `authOptions` → shared by API route + `getServerSession`
- `middleware.ts` protects `/dashboard/*` and `/trips/*` via `withAuth`
- `lib/parseItinerary.ts` → calls Claude (8192 max tokens), auto-chunks on `max_tokens`, strips fences, validates
- `lib/enrichAddresses.ts` → second Claude pass; sends all stops in chunks of 40 in parallel; Claude patches missing/vague addresses; falls back silently on any failure

## Key Files
```
app/layout.tsx                        root layout (SessionProvider, Google Fonts via <link>)
app/(app)/layout.tsx                  authenticated layout + NavBar
app/(app)/dashboard/page.tsx          server component; Prisma query
app/(app)/trips/new/page.tsx          server auth check → NewTripClient
app/(app)/trips/[id]/page.tsx         server auth check → TripCompanionClient
app/api/auth/[...nextauth]/route.ts
app/api/auth/signup/route.ts          POST; bcrypt hash
app/api/trips/route.ts                GET list + POST create (days+stops)
app/api/trips/parse/route.ts          POST → extractText → parseItinerary → enrichAddresses → {parsedData, rawText}
app/api/trips/[id]/route.ts           GET full trip; 401/403/404/500
components/TripCompanionClient.tsx    tab state: itinerary/map/chat/checklist
components/ItineraryTab.tsx           DaySelector + stop timeline; defaults to today or Day 1
components/DaySelector.tsx            horizontal pill buttons
components/StopCard.tsx               expandable; type icon + Get Directions
lib/auth.ts / lib/prisma.ts / lib/extractText.ts / lib/parseItinerary.ts / lib/enrichAddresses.ts
lib/prompts/parse-itinerary.ts        parse prompt (rule 7: address = real address or null)
lib/prompts/enrich-addresses.ts       enrich prompt + StopToEnrich type
types/itinerary.ts                    ParsedStop, ParsedDay, ParsedItinerary
types/trip.ts                         StopDetail, DayDetail, TripDetail (server→client safe)
prisma/schema.prisma                  Users Trips Days Stops ChecklistItems + NextAuth tables
middleware.ts
tests/setup.ts                        global mocks: Prisma, NextAuth, next/navigation
```

## DB Schema
- StopType enum: `hotel | restaurant | activity | transport | other`
- All IDs: `cuid()` strings; all FK relations: `onDelete: Cascade`
- NextAuth tables: Account, Session, VerificationToken

## Design Tokens
- Fonts: Cormorant Garamond (display), DM Sans (body)
- Rust: `#B85C30` (primary) · Parchment: `#F5EDD9` (bg) · Cream: `#FAF6EE` (body)
- Ink: `#1C1208` (text) · Forest: `#2E5E35` · Sage: `#8FAF7E` · Sky: `#4A7C9E`

## Testing
- Vitest v4 + React Testing Library + jsdom
- Prisma mocked globally; per-test: `vi.mocked(prisma.X.method).mockResolvedValue(...)`
- Server component tests: mock `next-auth` (not `/react`), `await Page()`, render result
- Use `getByLabelText("Password")` exact — regex matches "Show password" aria-label too
- Dates: `new Date("YYYY-MMT12:00:00.000Z")` for timezone safety (midnight UTC = prev day locally)
- `request.formData()` hangs with File in jsdom — mock the Request object instead
- Claude mock responses need `stop_reason` field; `"max_tokens"` required for chunking tests

## Phase Status (134 tests green through Phase 4 + P3 enrichment enhancement)
- P1 auth+schema · P2 dashboard+trips list · P3 upload+parse+create+enrich · P4 trip companion UI
- **Next: Phase 5 — Maps**

## Constraints
- Prisma v5 only — v7 breaks `@auth/prisma-adapter`
- Google Fonts via `<link>` tags only — CSS `@import` blocks Tailwind compiler
- Keep CLAUDE.md short; full notes live in memory/MEMORY.md
