import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

// Safe: Uses select to restrict fields
export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Safe: Using select clause
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
    },
  });

  return Response.json(users);
}

// Safe: Has timeout on external fetch
export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  // Safe: Has timeout via AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch("https://api.external-service.com/webhook", {
      method: "POST",
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: "Request failed" }, { status: 500 });
  }
}
