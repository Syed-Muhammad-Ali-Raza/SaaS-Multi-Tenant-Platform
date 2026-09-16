import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const refreshToken = request.cookies.get("refresh_token");

  // Protect (app) routes
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/members") || pathname.startsWith("/profile") || pathname.startsWith("/admin") || pathname.startsWith("/organizations")) {
    if (!refreshToken) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // Redirect logged-in users away from auth pages
  const authPaths = ["/login", "/register", "/forgot-password", "/reset-password", "/accept-invite"];
  if (authPaths.includes(pathname) && refreshToken) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/members/:path*", "/profile/:path*", "/admin/:path*", "/organizations/:path*", "/login", "/register", "/forgot-password", "/reset-password"],
};