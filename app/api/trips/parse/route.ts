import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { extractRawText, ExtractionError } from "@/lib/extractText";
import { parseItinerary, ParseError } from "@/lib/parseItinerary";
import { enrichAddresses } from "@/lib/enrichAddresses";
import { generatePackingList } from "@/lib/generatePackingList";
import { NextResponse } from "next/server";

/**
 * POST /api/trips/parse
 *
 * Accepts multipart/form-data with one of:
 *   - text:          string — pasted itinerary text
 *   - file:          File   — PDF, DOCX, or TXT file
 *   - googleDocsUrl: string — public Google Docs share URL
 *
 * Returns { parsedData: ParsedItinerary, rawText: string, packingList: PackingItem[] }
 *
 * Error codes:
 *   401 UNAUTHORIZED       — not authenticated
 *   400 NO_INPUT           — no input provided
 *   422 EXTRACTION_FAILED  — couldn't extract text from the file/URL
 *   422 PARSE_FAILED       — Claude returned invalid/incomplete JSON
 *   504 AI_TIMEOUT         — Claude API timed out or network error
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required.", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data.", code: "NO_INPUT" },
      { status: 400 }
    );
  }

  const text = formData.get("text") as string | null;
  const file = formData.get("file") as File | null;
  const googleDocsUrl = formData.get("googleDocsUrl") as string | null;

  if (!text?.trim() && !file && !googleDocsUrl?.trim()) {
    return NextResponse.json(
      { error: "Provide a text, file, or Google Docs URL.", code: "NO_INPUT" },
      { status: 400 }
    );
  }

  // Step 1: Extract raw text from the input
  let rawText: string;
  try {
    rawText = await extractRawText({ text, file, googleDocsUrl });
  } catch (err) {
    if (err instanceof ExtractionError) {
      return NextResponse.json(
        { error: err.message, code: "EXTRACTION_FAILED" },
        { status: 422 }
      );
    }
    if (err instanceof Error && err.message === "NO_INPUT") {
      return NextResponse.json(
        { error: "Provide a text, file, or Google Docs URL.", code: "NO_INPUT" },
        { status: 400 }
      );
    }
    throw err;
  }

  // Step 2: Parse the itinerary via the configured AI provider
  try {
    const parsed = await parseItinerary(rawText);
    // Run address enrichment and packing list generation in parallel
    const [parsedData, packingList] = await Promise.all([
      enrichAddresses(parsed),
      generatePackingList(parsed).catch(() => []),
    ]);
    return NextResponse.json({ parsedData, rawText, packingList });
  } catch (err) {
    if (err instanceof ParseError) {
      console.error("[parse] ParseError:", err.message);
      return NextResponse.json(
        { error: "Couldn't parse the itinerary. Try again or paste the text manually.", code: "PARSE_FAILED" },
        { status: 422 }
      );
    }
    // Network errors, timeouts, etc.
    const message = err instanceof Error ? err.message : String(err);
    console.error("[parse] Unexpected error:", message);
    if (message.includes("timeout") || message.includes("ETIMEDOUT") || message.includes("network")) {
      return NextResponse.json(
        { error: "The AI is taking too long to respond. Try again in a moment.", code: "AI_TIMEOUT" },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: "Something went wrong. Please try again.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
