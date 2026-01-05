// SAFE: Uses session.user.id and checks role
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // SAFE: Checks that user has a valid role before allowing comment creation
  if (!["admin", "moderator", "user"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // SAFE: Only extracts content and postId from body, uses session for author
  const { postId, content } = await request.json();

  await prisma.comment.create({
    data: {
      content,
      postId,
      authorId: session.user.id,  // SAFE: Uses session, not client input
    },
  });

  return NextResponse.json({ success: true });
}
