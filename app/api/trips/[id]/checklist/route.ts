import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Verifies the session and that the trip belongs to the user.
 * Returns { session, trip } on success, or a NextResponse error to return early.
 */
async function getAuthorizedTrip(tripId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return {
      error: NextResponse.json(
        { error: "Authentication required.", code: "UNAUTHORIZED" },
        { status: 401 }
      ),
    };
  }

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { id: true, user_id: true },
  });

  if (!trip) {
    return {
      error: NextResponse.json(
        { error: "Trip not found.", code: "NOT_FOUND" },
        { status: 404 }
      ),
    };
  }

  if (trip.user_id !== session.user.id) {
    return {
      error: NextResponse.json(
        { error: "You do not have access to this trip.", code: "FORBIDDEN" },
        { status: 403 }
      ),
    };
  }

  return { session, trip };
}

// ─── PATCH /api/trips/[id]/checklist ─────────────────────────────────────────

const PatchSchema = z.object({
  id: z.string().min(1),
  checked: z.boolean(),
});

/**
 * PATCH /api/trips/[id]/checklist
 *
 * Updates the checked state of a single checklist item.
 * The item must belong to the specified trip.
 *
 * Body: { id: string, checked: boolean }
 *
 * Responses:
 *   200 { item }
 *   400 VALIDATION_ERROR
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   404 NOT_FOUND (trip or item)
 *   500 INTERNAL_ERROR
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthorizedTrip(params.id);
  if ("error" in auth) return auth.error;

  let body: z.infer<typeof PatchSchema>;
  try {
    body = PatchSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid request body.", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  // Verify the item belongs to this trip.
  const existing = await prisma.checklistItem.findUnique({
    where: { id: body.id },
    select: { id: true, trip_id: true },
  });

  if (!existing || existing.trip_id !== params.id) {
    return NextResponse.json(
      { error: "Checklist item not found.", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  try {
    const item = await prisma.checklistItem.update({
      where: { id: body.id },
      data: { checked: body.checked },
    });
    return NextResponse.json({ item });
  } catch {
    return NextResponse.json(
      { error: "Failed to update checklist item.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// ─── POST /api/trips/[id]/checklist ──────────────────────────────────────────

const PostSchema = z.object({
  label: z.string().min(1, "Label is required."),
  category: z.string().min(1, "Category is required."),
});

/**
 * POST /api/trips/[id]/checklist
 *
 * Creates a custom checklist item for the trip.
 *
 * Body: { label: string, category: string }
 *
 * Responses:
 *   201 { item }
 *   400 VALIDATION_ERROR
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   404 NOT_FOUND
 *   500 INTERNAL_ERROR
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthorizedTrip(params.id);
  if ("error" in auth) return auth.error;

  let body: z.infer<typeof PostSchema>;
  try {
    body = PostSchema.parse(await request.json());
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? (err.issues[0]?.message ?? "Invalid request.")
        : "Invalid request.";
    return NextResponse.json(
      { error: message, code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  try {
    const item = await prisma.checklistItem.create({
      data: {
        trip_id: params.id,
        category: body.category,
        label: body.label,
        is_custom: true,
      },
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create checklist item.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/trips/[id]/checklist ────────────────────────────────────────

const DeleteSchema = z.object({
  itemId: z.string().min(1),
});

/**
 * DELETE /api/trips/[id]/checklist
 *
 * Deletes a checklist item. The item must belong to the specified trip.
 *
 * Body: { itemId: string }
 *
 * Responses:
 *   200 { success: true }
 *   400 VALIDATION_ERROR
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   404 NOT_FOUND
 *   500 INTERNAL_ERROR
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthorizedTrip(params.id);
  if ("error" in auth) return auth.error;

  let body: z.infer<typeof DeleteSchema>;
  try {
    body = DeleteSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid request body.", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  // Verify the item belongs to this trip.
  const existing = await prisma.checklistItem.findUnique({
    where: { id: body.itemId },
    select: { id: true, trip_id: true },
  });

  if (!existing || existing.trip_id !== params.id) {
    return NextResponse.json(
      { error: "Checklist item not found.", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  try {
    await prisma.checklistItem.delete({ where: { id: body.itemId } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete checklist item.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
