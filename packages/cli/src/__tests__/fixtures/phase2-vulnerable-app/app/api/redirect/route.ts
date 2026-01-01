import { NextResponse } from "next/server";

// VC-NET-002: Open redirect vulnerability
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const next = searchParams.get("next");

  // Vulnerable: redirecting to user-controlled URL
  return NextResponse.redirect(next!);
}
