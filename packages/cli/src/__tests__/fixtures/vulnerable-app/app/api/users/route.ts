import { prisma } from "@/lib/prisma";
import { z } from "zod";

const userSchema = z.object({
  name: z.string(),
  email: z.string().email(),
});

// VC-AUTH-001: No auth check before database write
export async function POST(request: Request) {
  const body = await request.json();

  // VC-VAL-001: Validation called but result ignored
  userSchema.parse(body);

  // Using raw body instead of validated data
  const user = await prisma.user.create({
    data: body,
  });

  // VC-PRIV-001: Logging sensitive data
  console.log("Created user:", { email: body.email, password: body.password });

  return Response.json(user);
}

// VC-AUTH-001: Critical - delete without auth
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  await prisma.user.delete({
    where: { id },
  });

  return Response.json({ success: true });
}
