import {
  buildSummaryDownloadText,
  hasCaptionText,
} from "./caption-format";
import type { CaptionSnapshot } from "./live-caption-types";

type CaptionSummaryDownloadOptions = {
  endedAt?: Date;
  startedAt?: Date;
};

type CaptionSummaryResponse = {
  summary?: string;
  error?: string;
};

async function requestCaptionSummary(snapshot: CaptionSnapshot) {
  const response = await fetch("/api/gemini/summary", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(snapshot),
  });

  const data = (await response.json().catch(() => null)) as
    | CaptionSummaryResponse
    | null;

  if (!response.ok || !data?.summary) {
    throw new Error(data?.error || "AI 요약 생성에 실패했습니다.");
  }

  return data.summary;
}

function downloadTextFile(filename: string, text: string) {
  const blob = new Blob(["\ufeff", text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatMonthDay(date: Date) {
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");

  return `${month}${day}`;
}

function formatHourMinute(date: Date) {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");

  return `${hours}${minutes}`;
}

function buildSessionSummaryFilename(startedAt: Date, endedAt: Date) {
  return `AIM${formatMonthDay(startedAt)}-${formatHourMinute(startedAt)}_to_${formatHourMinute(endedAt)}.txt`;
}

export async function downloadCaptionSummary(
  snapshot: CaptionSnapshot,
  options: CaptionSummaryDownloadOptions = {},
) {
  if (!hasCaptionText(snapshot)) {
    throw new Error("요약할 번역 내용이 없습니다.");
  }

  const summary = await requestCaptionSummary(snapshot);
  const endedAt = options.endedAt || new Date();
  const startedAt = options.startedAt || endedAt;
  const filename = buildSessionSummaryFilename(startedAt, endedAt);

  downloadTextFile(filename, buildSummaryDownloadText({ ...snapshot, summary }));

  return filename;
}
