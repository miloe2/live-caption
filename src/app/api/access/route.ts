import { NextResponse } from "next/server";

const ACCESS_COOKIE_NAME = "live_caption_access";
const ACCESS_COOKIE_VALUE = "granted";

type AccessRequest = {
  password?: unknown;
};

export async function POST(request: Request) {
  const accessPassword = process.env.ACCESS_PASSWORD;

  if (!accessPassword) {
    return NextResponse.json(
      {
        error: "ACCESS_PASSWORD is not configured.",
        code: "missing_access_password",
      },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => null)) as AccessRequest | null;
  const password = typeof body?.password === "string" ? body.password.trim() : "";

  if (password !== accessPassword) {
    return NextResponse.json(
      {
        error: "Invalid access code.",
        code: "invalid_access_code",
      },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true });

  response.cookies.set({
    name: ACCESS_COOKIE_NAME,
    value: ACCESS_COOKIE_VALUE,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  return response;
}
