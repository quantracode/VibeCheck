// SAFE: Enforces role check even though using session.user.id
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // SAFE: Checks role before allowing settings changes
  if (session.user.role !== "admin" && session.user.role !== "moderator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { settings } = await request.json();

  await prisma.settings.create({
    data: {
      ...settings,
      userId: session.user.id,
    },
  });

  return NextResponse.json({ success: true });
}
