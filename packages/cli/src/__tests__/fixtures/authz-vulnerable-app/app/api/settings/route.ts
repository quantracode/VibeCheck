// VC-AUTHZ-003: Roles defined in types.ts but not enforced here
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // session.user.role is available but never checked
  // Despite having Role types defined in lib/types.ts

  const { settings } = await request.json();

  await prisma.settings.create({
    data: {
      ...settings,
      userId: session.user.id,
    },
  });

  return NextResponse.json({ success: true });
}
