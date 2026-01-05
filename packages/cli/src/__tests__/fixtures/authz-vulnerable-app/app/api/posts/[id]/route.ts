// VC-AUTHZ-002: Missing ownership check
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";

export async function PUT(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // VULNERABLE: Uses userId from body without verifying it matches session
  const { userId, title, content } = await request.json();

  // No check: if (userId !== session.user.id)
  await prisma.post.update({
    where: { authorId: userId },
    data: { title, content },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // VULNERABLE: Deletes based on client-provided ownerId
  const { ownerId, postId } = await request.json();

  await prisma.post.delete({
    where: { id: postId, authorId: ownerId },
  });

  return NextResponse.json({ success: true });
}
