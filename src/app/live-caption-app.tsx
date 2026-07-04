"use client";

import { useRecording } from "@soniox/react";
import type { RecordingState, SttSessionConfig } from "@soniox/client";
import { Clock3, Play, RotateCcw, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type CaptionMode = "en-ko" | "ko-en";
type AppStatus =
  | "Ready"
  | "Requesting microphone"
  | "Connecting"
  | "Live"
  | "Reconnecting"
  | "Stopped"
  | "Error";

type SonioxConnectionConfig = {
  api_key: string;
};

const AUTO_FINALIZE_MS = 7000;
const SESSION_LIMIT_MS = 30 * 60 * 1000;
const SESSION_WARNING_MS = 5 * 60 * 1000;
const DISPLAY_UTTERANCE_COUNT = 5;
const MAX_CAPTION_CHARS = 62;
const DEFAULT_TERMS = [
  "grain boundary",
  "dislocation",
  "annealing",
  "phase transformation",
  "yield strength",
  "tensile strength",
  "thin film",
  "deposition",
  "scanning electron microscopy",
  "SEM",
  "X-ray diffraction",
  "XRD",
  "microstructure",
  "crystal structure",
  "diffusion",
  "fatigue",
  "creep",
  "fracture toughness",
  "elastic modulus",
  "hardness",
  "nanostructure",
  "sintering",
  "alloy",
  "composite",
  "corrosion",
];

const TRANSLATION_TERMS = [
  ["grain boundary", "결정립계"],
  ["dislocation", "전위"],
  ["annealing", "어닐링"],
  ["phase transformation", "상변태"],
  ["yield strength", "항복강도"],
  ["tensile strength", "인장강도"],
  ["thin film", "박막"],
  ["deposition", "증착"],
  ["scanning electron microscopy", "주사전자현미경"],
  ["X-ray diffraction", "X선 회절"],
  ["microstructure", "미세구조"],
  ["diffusion", "확산"],
  ["fatigue", "피로"],
  ["creep", "크리프"],
  ["fracture toughness", "파괴인성"],
  ["elastic modulus", "탄성계수"],
].map(([source, target]) => ({ source, target }));

async function requestSonioxConnectionConfig(): Promise<SonioxConnectionConfig> {
  const response = await fetch("/api/soniox/temporary-key", {
    method: "POST",
    headers: {
      Accept: "application/json",
    },
  });

  const data = (await response.json().catch(() => null)) as
    | {
        api_key?: string;
        error?: string;
        max_session_duration_seconds?: number;
      }
    | null;

  if (!response.ok || !data?.api_key) {
    throw new Error(data?.error || "Failed to request Soniox temporary key.");
  }

  return { api_key: data.api_key };
}

function statusFromRecordingState(
  state: RecordingState,
  isReconnecting: boolean,
  fallback: AppStatus,
): AppStatus {
  if (isReconnecting || state === "reconnecting") return "Reconnecting";
  if (state === "starting" || state === "connecting") return "Connecting";
  if (state === "recording" || state === "paused") return "Live";
  if (state === "stopping" || state === "stopped" || state === "canceled") {
    return "Stopped";
  }
  if (state === "error") return "Error";
  return fallback;
}

function humanErrorMessage(error: Error | null, unsupportedReason?: string) {
  if (unsupportedReason === "insecure-context") {
    return "마이크 사용에는 HTTPS 또는 localhost 보안 컨텍스트가 필요합니다.";
  }
  if (unsupportedReason === "no-mediadevices" || unsupportedReason === "no-getusermedia") {
    return "이 브라우저에서 마이크 입력을 사용할 수 없습니다.";
  }
  if (!error) {
    return null;
  }

  if (error.message.includes("30분 사용 제한")) {
    return error.message;
  }

  const message = error.message.toLowerCase();

  if (message.includes("permission") || message.includes("notallowed")) {
    return "마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크 접근을 허용해 주세요.";
  }
  if (message.includes("temporary") || message.includes("api key")) {
    return "Soniox temporary key 발급에 실패했습니다. 서버 환경변수와 네트워크를 확인해 주세요.";
  }
  if (message.includes("network") || message.includes("websocket")) {
    return "Soniox 연결 또는 네트워크에 문제가 있습니다.";
  }

  return "실시간 자막 처리 중 오류가 발생했습니다.";
}

function splitCaptionText(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [];
  }

  const sentenceMatches = normalized.match(/[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/g) || [normalized];

  const captions: string[] = [];

  for (const sentence of sentenceMatches) {
    const cleanSentence = sentence.trim();
    if (!cleanSentence) {
      continue;
    }

    const phraseMatches =
      cleanSentence.match(/[^,;:，；：]+[,;:，；：]+|[^,;:，；：]+$/g) || [
        cleanSentence,
      ];

    const words = phraseMatches.flatMap((phrase) => phrase.trim().split(" "));
    let line = "";

    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (next.length > MAX_CAPTION_CHARS && line) {
        captions.push(line);
        line = word;
      } else {
        line = next;
      }
    }

    if (line) {
      captions.push(line);
    }
  }

  return captions;
}

function displayCaptionLines(text: string, partialText: string) {
  const fullLines = splitCaptionText(text);
  const partialLines = splitCaptionText(partialText);
  const partialStart = Math.max(0, fullLines.length - partialLines.length);

  return fullLines.slice(-DISPLAY_UTTERANCE_COUNT).map((lineText, index, lines) => ({
    id: `${index}-${lineText}`,
    text: lineText,
    isPartial:
      partialLines.length > 0 &&
      fullLines.length - lines.length + index >= partialStart,
  }));
}

function formatDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function StatusBadge({
  elapsedMs,
  status,
}: {
  elapsedMs?: number | null;
  status: AppStatus;
}) {
  const className =
    status === "Live"
      ? "border-transparent bg-[#e3f4ed] text-[#0e5c4a]"
      : status === "Error"
        ? "border-red-300 bg-red-50 text-red-800"
        : status === "Reconnecting"
          ? "border-amber-300 bg-amber-50 text-amber-800"
          : "border-[#d4ddd5] bg-white text-[#66706a]";

  return (
    <span
      className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-medium ${className}`}
    >
      {status === "Live" && <span className="size-2 rounded-full bg-[#19a873]" />}
      {status}
      {status === "Live" && elapsedMs !== null && elapsedMs !== undefined && (
        <span className="tabular-nums">{formatDuration(elapsedMs)}</span>
      )}
    </span>
  );
}

function IconButton({
  children,
  disabled,
  onClick,
  title,
  variant = "secondary",
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  title?: string;
  variant?: "primary" | "secondary" | "danger";
}) {
  const variants = {
    primary: "border-slate-950 bg-slate-950 text-white hover:bg-slate-800",
    secondary: "border-slate-300 bg-white text-slate-900 hover:bg-slate-100",
    danger: "border-red-300 bg-red-50 text-red-800 hover:bg-red-100",
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-full border px-3 text-xs font-medium leading-none transition disabled:cursor-not-allowed disabled:opacity-45 ${variants[variant]}`}
    >
      {children}
    </button>
  );
}

export default function LiveCaptionApp() {
  const [mode, setMode] = useState<CaptionMode>("en-ko");
  const [statusOverride, setStatusOverride] = useState<AppStatus>("Ready");
  const [manualError, setManualError] = useState<Error | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const translatedEndRef = useRef<HTMLDivElement | null>(null);

  const sessionConfig = useMemo<SttSessionConfig>(
    () => ({
      model: "stt-rt-v5",
      language_hints: [mode === "en-ko" ? "en" : "ko"],
      language_hints_strict: true,
      enable_endpoint_detection: true,
      max_endpoint_delay_ms: 800,
      endpoint_sensitivity: 0.6,
      context: {
        general: [
          {
            key: "domain",
            value: "materials science conference presentation",
          },
        ],
        terms: DEFAULT_TERMS,
        translation_terms: mode === "en-ko" ? TRANSLATION_TERMS : undefined,
      },
      translation:
        mode === "en-ko"
          ? { type: "one_way", target_language: "ko" }
          : { type: "one_way", target_language: "en" },
    }),
    [mode],
  );

  const recording = useRecording({
    config: requestSonioxConnectionConfig,
    ...sessionConfig,
    groupBy: "translation",
    resetOnStart: false,
    auto_reconnect: true,
    max_reconnect_attempts: 5,
    reconnect_base_delay_ms: 1000,
    reset_transcript_on_reconnect: false,
    onError: (error) => {
      setManualError(error);
      setStatusOverride("Error");
    },
    onConnected: () => {
      const connectedAt = Date.now();

      setManualError(null);
      setStatusOverride("Live");
      setNow(connectedAt);
      setSessionExpiresAt(connectedAt + SESSION_LIMIT_MS);
    },
    onReconnecting: () => {
      setStatusOverride("Reconnecting");
    },
    onFinished: () => {
      setStatusOverride("Stopped");
      setSessionExpiresAt(null);
    },
  });

  useEffect(() => {
    if (!recording.isRecording) {
      return;
    }

    const id = window.setInterval(() => {
      recording.finalize({ trailing_silence_ms: 500 });
    }, AUTO_FINALIZE_MS);

    return () => window.clearInterval(id);
  }, [recording]);

  useEffect(() => {
    if (!recording.isActive) {
      return;
    }

    const id = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(id);
  }, [recording.isActive]);

  useEffect(() => {
    if (!recording.isActive || sessionExpiresAt === null || now < sessionExpiresAt) {
      return;
    }

    void recording.stop().finally(() => {
      setStatusOverride("Stopped");
      setSessionExpiresAt(null);
      setManualError(
        new Error("30분 사용 제한으로 자동 정지되었습니다. 계속 사용하려면 Start를 다시 눌러 주세요."),
      );
    });
  }, [now, recording, sessionExpiresAt]);

  const status = statusFromRecordingState(
    recording.state,
    recording.isReconnecting,
    statusOverride,
  );
  const effectiveError = manualError || recording.error;
  const errorMessage = humanErrorMessage(effectiveError, recording.unsupportedReason);
  const remainingSessionMs =
    recording.isActive && sessionExpiresAt !== null
      ? Math.max(0, sessionExpiresAt - now)
      : null;
  const elapsedSessionMs =
    remainingSessionMs !== null ? SESSION_LIMIT_MS - remainingSessionMs : null;
  const isSessionWarning =
    remainingSessionMs !== null && remainingSessionMs <= SESSION_WARNING_MS;

  const original = recording.groups.original;
  const translation = recording.groups.translation;
  const translatedTitle = mode === "en-ko" ? "한국어 번역" : "English translation";
  const originalTitle = mode === "en-ko" ? "English original" : "한국어 원문";

  const translatedPartial = translation?.partialText || "";
  const originalPartial = original?.partialText || "";
  const translatedLines = displayCaptionLines(
    translation?.text || "",
    translatedPartial,
  );
  const originalLines = displayCaptionLines(original?.text || "", originalPartial);
  const hasTranslatedText = translatedLines.length > 0;
  const hasOriginalText = originalLines.length > 0;
  const translatedScrollKey = translatedLines
    .map((line) => `${line.text}:${line.isPartial}`)
    .join("|");

  useEffect(() => {
    translatedEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [translatedScrollKey]);

  async function handleStart() {
    setManualError(null);

    if (!recording.isSupported) {
      setManualError(new Error(recording.unsupportedReason || "Unsupported browser"));
      setStatusOverride("Error");
      return;
    }

    setStatusOverride("Requesting microphone");
    recording.start();
  }

  async function handleStop() {
    await recording.stop();
    setStatusOverride("Stopped");
    setSessionExpiresAt(null);
  }

  async function handleExtend() {
    if (!recording.isActive) {
      await handleStart();
      return;
    }

    setManualError(null);
    setStatusOverride("Requesting microphone");
    await recording.stop();
    recording.start();
  }

  async function switchMode(nextMode: CaptionMode) {
    if (nextMode === mode) return;
    if (recording.isActive) {
      await recording.stop();
    }
    setMode(nextMode);
    setStatusOverride("Stopped");
    setSessionExpiresAt(null);
  }

  return (
    <main className="flex h-dvh overflow-hidden flex-col bg-[#f5f7f4] text-[#17201b]">
      <header className="shrink-0 border-b border-[#d4ddd5] bg-white px-2.5 py-2.5 sm:px-5">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2">
          <StatusBadge elapsedMs={elapsedSessionMs} status={status} />
          <div className="flex items-center gap-2">
            {isSessionWarning && (
              <IconButton
                onClick={() => void handleExtend()}
                title="30분 세션을 새로 시작합니다."
              >
                <Clock3 className="shrink-0 translate-y-px" size={15} aria-hidden="true" />
                <span className="sr-only">Extend</span>
              </IconButton>
            )}
            <button
              type="button"
              onClick={() => void switchMode(mode === "en-ko" ? "ko-en" : "en-ko")}
              className="h-8 rounded-full border border-[#d4ddd5] bg-[#edf3ee] px-3 text-xs font-medium leading-none text-[#17201b]"
            >
              {mode === "en-ko" ? "EN → KO" : "KO → EN"}
            </button>
            <IconButton onClick={recording.clearTranscript}>
              <RotateCcw className="shrink-0 translate-y-px" size={15} aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">Clear</span>
            </IconButton>
            <IconButton
              variant={recording.isActive ? "danger" : "primary"}
              onClick={() =>
                recording.isActive ? void handleStop() : void handleStart()
              }
            >
              {recording.isActive ? (
                <Square className="shrink-0 translate-y-px" size={15} aria-hidden="true" />
              ) : (
                <Play className="shrink-0 translate-y-px" size={15} aria-hidden="true" />
              )}
              {recording.isActive ? "Stop" : "Start"}
            </IconButton>
          </div>
        </div>
      </header>

      {mode === "ko-en" && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm font-semibold text-amber-900">
          테스트 모드입니다. <br/> 현장 기본 사용은 EN → KO · Conference입니다.
        </div>
      )}

      <section className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-3 px-3 py-3 sm:px-5 sm:py-4">
        {errorMessage && (
          <div className="rounded-md border border-red-300 bg-red-50 p-4 text-red-900">
            <p className="font-semibold">{errorMessage}</p>
            {effectiveError && (
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer font-semibold">Details</summary>
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-white p-3 text-xs text-red-950">
                  {effectiveError.stack || effectiveError.message}
                </pre>
              </details>
            )}
          </div>
        )}

        <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(120px,0.34fr)] gap-3 lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-1">
          <article className="flex min-h-0 flex-col rounded-md border border-[#d4ddd5] bg-white p-3 shadow-sm sm:p-4">
            <h2 className="text-sm font-extrabold uppercase text-[#66706a]">
              {translatedTitle}
            </h2>
            <div className="caption-scroll mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="space-y-3 break-words text-[clamp(1.75rem,7.2vw,4.25rem)] font-medium leading-[1.24] tracking-normal text-[#17201b]">
                {!hasTranslatedText && (
                  <span className="text-[#9aa29d]">
                    Start를 누르면 번역 자막이 표시됩니다.
                  </span>
                )}
                {translatedLines.map((line, index) => (
                  <p
                    key={line.id}
                    className={
                      line.isPartial
                        ? "border-l-4 border-[#1d6f5f] pl-3 text-[#1d6f5f] sm:pl-4"
                        : index === translatedLines.length - 1
                        ? "border-l-4 border-[#17201b] pl-3 text-[#17201b] sm:pl-4"
                        : "border-l-4 border-[#d4ddd5] pl-3 text-[#7a837d] sm:pl-4"
                    }
                  >
                    {line.text}
                  </p>
                ))}
                <div ref={translatedEndRef} />
              </div>
            </div>
          </article>

          <article className="flex min-h-0 flex-col rounded-md border border-[#d4ddd5] bg-white p-3 shadow-sm sm:p-4">
            <h2 className="text-sm font-extrabold uppercase text-[#66706a]">
              {originalTitle}
            </h2>
            <div className="caption-scroll mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="space-y-2 break-words text-[clamp(1rem,3.7vw,1.45rem)] font-medium leading-snug text-[#26332c] lg:text-xl">
                {!hasOriginalText && (
                  <span className="text-[#9aa29d]">Original text appears here.</span>
                )}
                {originalLines.map((line, index) => (
                  <p
                    key={line.id}
                    className={
                      line.isPartial
                        ? "border-l-4 border-[#1d6f5f] pl-3 text-[#1d6f5f]"
                        : index === originalLines.length - 1
                        ? "border-l-4 border-[#66706a] pl-3 text-[#26332c]"
                        : "border-l-4 border-[#d4ddd5] pl-3 text-[#7a837d]"
                    }
                  >
                    {line.text}
                  </p>
                ))}
              </div>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
