import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ACCESS_COOKIE_NAME = "live_caption_access";
const ACCESS_COOKIE_VALUE = "granted";

function hasAccessCookie(request: NextRequest) {
  return request.cookies.get(ACCESS_COOKIE_NAME)?.value === ACCESS_COOKIE_VALUE;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasAccess = hasAccessCookie(request);

  if (pathname === "/access") {
    if (hasAccess) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  }

  if (pathname === "/api/access") {
    return NextResponse.next();
  }

  if (!hasAccess) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: "Access code required.",
          code: "access_required",
        },
        { status: 401 },
      );
    }

    return NextResponse.redirect(new URL("/access", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
