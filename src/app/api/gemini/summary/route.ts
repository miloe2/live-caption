import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type CaptionMode = "en-ko" | "ko-en";

type CaptionSummaryRequest = {
  mode?: CaptionMode;
  originalPartialText?: string;
  originalText?: string;
  partialText?: string;
  text?: string;
};

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
    status?: string;
  };
};

const ACCESS_COOKIE_NAME = "live_caption_access";
const ACCESS_COOKIE_VALUE = "granted";
const MAX_INPUT_CHARS = 60000;
const DEFAULT_SUMMARY_MODELS = ["gemini-2.5-flash-lite", "gemini-flash-lite-latest"];

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function extractOutputText(data: GeminiGenerateContentResponse) {
  return (
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("\n")
      .trim() || ""
  );
}

function buildTranscriptForSummary({
  mode,
  originalPartialText,
  originalText,
  partialText,
  text,
}: Required<CaptionSummaryRequest>) {
  const direction = mode === "en-ko" ? "EN -> KO" : "KO -> EN";

  return [
    `Mode: ${direction}`,
    "",
    "Translated captions:",
    text,
    partialText ? `\nIn-progress translated partial:\n${partialText}` : "",
    "",
    "Original captions:",
    originalText,
    originalPartialText
      ? `\nIn-progress original partial:\n${originalPartialText}`
      : "",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_INPUT_CHARS);
}

function summaryModelsFromEnv() {
  const configuredModels = process.env.GEMINI_SUMMARY_MODEL?.split(",")
    .map((model) => model.trim())
    .filter(Boolean);

  return configuredModels?.length ? configuredModels : DEFAULT_SUMMARY_MODELS;
}

export async function POST(request: Request) {
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

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error: "GEMINI_API_KEY is not configured.",
        code: "missing_gemini_api_key",
      },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | CaptionSummaryRequest
    | null;

  const mode = body?.mode === "ko-en" ? "ko-en" : "en-ko";
  const snapshot: Required<CaptionSummaryRequest> = {
    mode,
    originalPartialText: cleanText(body?.originalPartialText),
    originalText: cleanText(body?.originalText),
    partialText: cleanText(body?.partialText),
    text: cleanText(body?.text),
  };

  const hasText = Boolean(
    snapshot.text ||
      snapshot.partialText ||
      snapshot.originalText ||
      snapshot.originalPartialText,
  );

  if (!hasText) {
    return NextResponse.json(
      {
        error: "No caption text to summarize.",
        code: "empty_caption_text",
      },
      { status: 400 },
    );
  }

  const responseLanguage = mode === "en-ko" ? "Korean" : "English";
  const transcript = buildTranscriptForSummary(snapshot);
  const models = summaryModelsFromEnv();
  let lastError = "Failed to summarize captions with Gemini.";

  try {
    for (const model of models) {
      console.info(`[gemini-summary] trying model=${model}`);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [
                {
                  text: "Summarize live conference captions. Preserve technical terms and proper nouns. Do not add facts that are not in the transcript.",
                },
              ],
            },
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `Write the summary in ${responseLanguage}. Return a concise title, 3-6 key bullets, and action items only if they are explicitly mentioned.\n\n${transcript}`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 700,
            },
          }),
        },
      );

      console.info(`[gemini-summary] model=${model} status=${response.status}`);

      const data = (await response.json().catch(() => null)) as
        | GeminiGenerateContentResponse
        | null;

      if (!response.ok) {
        lastError =
          data?.error?.message || `Gemini summary failed with ${model}.`;
        console.warn(`[gemini-summary] model=${model} error=${lastError}`);
        continue;
      }

      const summary = data ? extractOutputText(data) : "";

      if (!summary) {
        lastError = `Gemini returned an empty summary with ${model}.`;
        console.warn(`[gemini-summary] model=${model} empty response`);
        continue;
      }

      console.info(`[gemini-summary] model=${model} succeeded`);

      return NextResponse.json(
        { summary, model },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    return NextResponse.json(
      {
        error: lastError,
        code: "gemini_summary_failed",
      },
      { status: 502 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unknown Gemini summary error",
        code: "gemini_summary_request_failed",
      },
      { status: 502 },
    );
  }
}
