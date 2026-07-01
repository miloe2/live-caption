import { SonioxHttpError, SonioxNodeClient } from "@soniox/node";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type TemporaryKeyResponse = {
  api_key: string;
  expires_at: string;
};

export async function POST() {
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
      max_session_duration_seconds: 18_000,
      client_reference_id: "live-caption-web",
    });

    const response: TemporaryKeyResponse = {
      api_key: temporaryKey.api_key,
      expires_at: temporaryKey.expires_at,
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
