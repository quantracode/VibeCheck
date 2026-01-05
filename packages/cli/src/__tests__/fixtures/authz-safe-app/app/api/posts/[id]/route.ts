// SAFE: Proper ownership checks and role verification
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // SAFE: Checks role
  if (!session.user.role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { title, content } = await request.json();

  // SAFE: Uses session.user.id for ownership verification
  const post = await prisma.post.findFirst({
    where: {
      id: params.id,
      authorId: session.user.id  // Only owner can update
    },
  });

  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.post.update({
    where: { id: params.id },
    data: { title, content },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // SAFE: Checks role
  if (!session.user.role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // SAFE: Verifies ownership before deletion
  const post = await prisma.post.findFirst({
    where: {
      id: params.id,
      authorId: session.user.id
    },
  });

  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.post.delete({
    where: { id: params.id },
  });

  return NextResponse.json({ success: true });
}
