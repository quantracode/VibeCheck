import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const userSchema = z.object({
  name: z.string(),
  email: z.string().email(),
});

// Properly authenticated and validated
export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const validated = userSchema.parse(body);

  // Using validated data
  const user = await prisma.user.create({
    data: validated,
  });

  return NextResponse.json(user);
}

// Properly authenticated
export async function DELETE(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  await prisma.user.delete({
    where: { id: id! },
  });

  return NextResponse.json({ success: true });
}
