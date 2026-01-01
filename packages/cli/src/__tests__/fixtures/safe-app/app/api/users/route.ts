import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { z } from "zod";

const userSchema = z.object({
  name: z.string(),
  email: z.string().email(),
});

// Safe: Has auth check
export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  // Safe: Validation result is used
  const validatedData = userSchema.parse(body);

  const user = await prisma.user.create({
    data: validatedData,
  });

  // Safe: Not logging sensitive data
  console.log("Created user:", { id: user.id, timestamp: Date.now() });

  return Response.json(user);
}

// Safe: Has auth check
export async function DELETE(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  await prisma.user.delete({
    where: { id },
  });

  return Response.json({ success: true });
}
