// VC-AUTHZ-001: Admin route with auth but no role guard
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";

export async function GET() {
  // Has auth check
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // VULNERABLE: No role check - any authenticated user can access admin route
  const users = await prisma.user.findMany();
  return NextResponse.json(users);
}

export async function DELETE(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // VULNERABLE: No role check for destructive operation
  const { userId } = await request.json();
  await prisma.user.delete({ where: { id: userId } });
  return NextResponse.json({ success: true });
}
