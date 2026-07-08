import { SonioxHttpError, SonioxNodeClient } from "@soniox/node";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type TemporaryKeyResponse = {
  api_key: string;
  expires_at: string;
  max_session_duration_seconds: number;
};

const MAX_SESSION_DURATION_SECONDS = 60 * 60;
const ACCESS_COOKIE_NAME = "live_caption_access";
const ACCESS_COOKIE_VALUE = "granted";

export async function POST() {
  const cookieStore = await cookies();
  const hasAccess =
    cookieStore.get(ACCESS_COOKIE_NAME)?.value === ACCESS_COOKIE_VALUE;

  if (!hasAccess) {
    return NextResponse.json(
      {
        error: "Access code required.",
        code: "access_required",
      },
      { status: 401 },
    );
  }

  const apiKey = process.env.SONIOX_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error: "SONIOX_API_KEY is not configured.",
        code: "missing_soniox_api_key",
      },
      { status: 500 },
    );
  }

  try {
    const client = new SonioxNodeClient({ api_key: apiKey });
    const temporaryKey = await client.auth.createTemporaryKey({
      usage_type: "transcribe_websocket",
      expires_in_seconds: 300,
      single_use: true,
      max_session_duration_seconds: MAX_SESSION_DURATION_SECONDS,
      client_reference_id: "live-caption-web",
    });

    const response: TemporaryKeyResponse = {
      api_key: temporaryKey.api_key,
      expires_at: temporaryKey.expires_at,
      max_session_duration_seconds: MAX_SESSION_DURATION_SECONDS,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const detail =
      error instanceof SonioxHttpError
        ? {
            code: error.code,
            statusCode: error.statusCode,
            message: error.message,
          }
        : {
            message:
              error instanceof Error
                ? error.message
                : "Unknown temporary key error",
          };

    return NextResponse.json(
      {
        error: "Failed to create Soniox temporary key.",
        detail,
      },
      { status: 502 },
    );
  }
}
