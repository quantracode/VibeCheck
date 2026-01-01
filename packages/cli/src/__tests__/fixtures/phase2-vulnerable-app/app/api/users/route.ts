import { prisma } from "@/lib/prisma";

// VC-PRIV-002: Over-broad response - returns full user model
export async function GET() {
  // Vulnerable: No select clause, returns all fields including password
  const users = await prisma.user.findMany();
  return Response.json(users);
}

// VC-NET-004: Missing timeout on external fetch
export async function POST(request: Request) {
  const body = await request.json();

  // Vulnerable: No timeout on external fetch
  const response = await fetch("https://api.external-service.com/webhook", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return Response.json({ success: true });
}
