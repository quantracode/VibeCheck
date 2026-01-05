// SAFE: Admin route with proper role guard
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // SAFE: Checks user role before allowing admin access
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany();
  return NextResponse.json(users);
}

export async function DELETE(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // SAFE: Role check for destructive operation
  if (!["admin", "moderator"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await request.json();
  await prisma.user.delete({ where: { id: userId } });
  return NextResponse.json({ success: true });
}
