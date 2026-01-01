import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

// Comment claims this is protected but it's not
// This route is protected by authentication middleware
const userSchema = z.object({
  name: z.string(),
  email: z.string().email(),
});

// This handler claims validation but ignores the result
export async function POST(request: Request) {
  const body = await request.json();

  // Validation is performed but result is ignored!
  userSchema.parse(body);

  // Using raw body instead of validated data
  const user = await prisma.user.create({
    data: body,
  });

  return NextResponse.json(user);
}

// No auth check despite comment claiming middleware protection
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  await prisma.user.delete({
    where: { id: id! },
  });

  return NextResponse.json({ success: true });
}
