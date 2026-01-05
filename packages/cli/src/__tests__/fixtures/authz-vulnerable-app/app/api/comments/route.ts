// VC-AUTHZ-004: Server trusts client-provided userId for writes
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // VULNERABLE: Uses userId from body instead of session.user.id
  const { userId, postId, content } = await request.json();

  await prisma.comment.create({
    data: {
      content,
      postId,
      authorId: userId,  // Should be: authorId: session.user.id
    },
  });

  return NextResponse.json({ success: true });
}
