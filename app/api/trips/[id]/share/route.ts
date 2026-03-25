import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import crypto from "node:crypto";

async function getOwnerTrip(tripId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Authentication required.", code: "UNAUTHORIZED" }, { status: 401 }) };
  }
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { id: true, user_id: true, share_token: true },
  });
  if (!trip) {
    return { error: NextResponse.json({ error: "Trip not found.", code: "NOT_FOUND" }, { status: 404 }) };
  }
  if (trip.user_id !== session.user.id) {
    return { error: NextResponse.json({ error: "You do not have access to this trip.", code: "FORBIDDEN" }, { status: 403 }) };
  }
  return { trip };
}

/** POST /api/trips/[id]/share — generate share token (idempotent; Node.js runtime only) */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await getOwnerTrip(params.id);
  if ("error" in auth) return auth.error;

  const { trip } = auth;
  const baseUrl = process.env.NEXTAUTH_URL ?? "";

  if (trip.share_token) {
    return NextResponse.json({ url: `${baseUrl}/share/${trip.share_token}` });
  }

  const token = crypto.randomBytes(32).toString("hex");
  await prisma.trip.update({ where: { id: trip.id }, data: { share_token: token } });
  return NextResponse.json({ url: `${baseUrl}/share/${token}` });
}

/** DELETE /api/trips/[id]/share — revoke share token (keeps TripFollow records) */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await getOwnerTrip(params.id);
  if ("error" in auth) return auth.error;

  await prisma.trip.update({ where: { id: auth.trip.id }, data: { share_token: null } });
  return NextResponse.json({ success: true });
}
