// Middleware that doesn't cover all API routes
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Only protect dashboard routes, not API
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
