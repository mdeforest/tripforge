import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildChatSystemPrompt } from "@/lib/prompts/chat-system-prompt";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import type { OptionType } from "@/types/itinerary";

const MessageSchema = z.object({
  role: z.enum(["user", "model"]),
  content: z.string().min(1),
});

const BodySchema = z.object({
  messages: z.array(MessageSchema).min(1),
});

let _genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) _genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
  return _genAI;
}

/**
 * POST /api/trips/[id]/chat
 *
 * Streaming chat endpoint. Accepts a conversation history and returns a
 * streaming text response from Gemini 2.0 Flash with Google Search grounding.
 *
 * Body: { messages: Array<{ role: "user" | "model"; content: string }> }
 *
 * Responses:
 *   200  text/plain streaming
 *   400  { error, code: "INVALID_REQUEST" }
 *   401  { error, code: "UNAUTHORIZED" }
 *   403  { error, code: "FORBIDDEN" }
 *   404  { error, code: "NOT_FOUND" }
 *   500  { error, code: "INTERNAL_ERROR" }
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response(
      JSON.stringify({ error: "Authentication required.", code: "UNAUTHORIZED" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // Parse + validate request body
  let body: z.infer<typeof BodySchema>;
  try {
    const raw = await request.json();
    body = BodySchema.parse(raw);
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid request body.", code: "INVALID_REQUEST" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Fetch trip with all fields needed for the system prompt
  const trip = await prisma.trip.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      user_id: true,
      name: true,
      destination: true,
      start_date: true,
      end_date: true,
      days: {
        orderBy: { day_number: "asc" },
        select: {
          id: true,
          day_number: true,
          date: true,
          title: true,
          notes: true,
          stops: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              name: true,
              type: true,
              time: true,
              address: true,
              lat: true,
              lng: true,
              notes: true,
              order: true,
              options: true,
            },
          },
        },
      },
    },
  }).catch(() => null);

  if (!trip) {
    return new Response(
      JSON.stringify({ error: "Trip not found.", code: "NOT_FOUND" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const isOwner = trip.user_id === session.user.id;
  if (!isOwner) {
    const follow = await prisma.tripFollow.findUnique({
      where: {
        follower_id_trip_id: {
          follower_id: session.user.id,
          trip_id: trip.id,
        },
      },
      select: { id: true },
    });
    if (!follow) {
      return new Response(
        JSON.stringify({ error: "You do not have access to this trip.", code: "FORBIDDEN" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // Serialize dates for the system prompt builder
  const tripForPrompt = {
    ...trip,
    start_date: trip.start_date?.toISOString().slice(0, 10) ?? null,
    end_date: trip.end_date?.toISOString().slice(0, 10) ?? null,
    days: trip.days.map((d) => ({
      ...d,
      date: d.date?.toISOString().slice(0, 10) ?? null,
      stops: d.stops.map((s) => ({
        ...s,
        options: ((s.options ?? []) as Record<string, unknown>[]).map((o) => ({
          name: String(o.name ?? ""),
          type: String(o.type ?? "activity") as OptionType,
          address: o.address != null ? String(o.address) : null,
          lat: o.lat != null ? Number(o.lat) : null,
          lng: o.lng != null ? Number(o.lng) : null,
          notes: o.notes != null ? String(o.notes) : null,
          order: Number(o.order ?? 0),
        })),
      })),
    })),
  };

  const systemPrompt = buildChatSystemPrompt(tripForPrompt);

  // Convert to Gemini contents format (history minus last message)
  const contents = body.messages.map((m) => ({
    role: m.role,
    parts: [{ text: m.content }],
  }));

  try {
    const genAI = getGenAI();
    const modelName = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
    // Gemini 2.x uses `googleSearch`; Gemini 1.5 uses `googleSearchRetrieval`
    const searchTool = modelName.startsWith("gemini-2")
      ? { googleSearch: {} }
      : { googleSearchRetrieval: {} };
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: systemPrompt,
      tools: [searchTool],
    });

    const result = await model.generateContentStream({ contents });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) controller.enqueue(encoder.encode(text));
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    console.error("[chat] Gemini error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to generate response.", code: "INTERNAL_ERROR" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
