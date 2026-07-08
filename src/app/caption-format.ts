import type { CaptionSnapshot } from "./live-caption-types";

const MAX_CAPTION_CHARS = 62;

function splitCaptionText(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [];
  }

  const sentenceMatches =
    normalized.match(/[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/g) || [normalized];

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

export function displayCaptionLines(text: string, partialText: string) {
  const fullLines = splitCaptionText(text);
  const partialLines = splitCaptionText(partialText);
  const partialStart = Math.max(0, fullLines.length - partialLines.length);

  return fullLines.map((lineText, index, lines) => ({
    id: `${index}-${lineText}`,
    text: lineText,
    isPartial:
      partialLines.length > 0 &&
      fullLines.length - lines.length + index >= partialStart,
  }));
}

export function formatDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function hasCaptionText(snapshot: CaptionSnapshot) {
  return Boolean(
    snapshot.text.trim() ||
      snapshot.partialText.trim() ||
      snapshot.originalText.trim() ||
      snapshot.originalPartialText.trim(),
  );
}

export function buildSummaryDownloadText({
  mode,
  originalPartialText,
  originalText,
  partialText,
  summary,
  text,
}: CaptionSnapshot & { summary: string }) {
  const savedAt = new Date();
  const direction = mode === "en-ko" ? "EN -> KO" : "KO -> EN";
  const translatedTitle = mode === "en-ko" ? "번역본 (한국어)" : "Translation (English)";
  const originalTitle = mode === "en-ko" ? "원문 (English)" : "Original (한국어)";
  const sections = [
    "Live Conference Captions",
    `Saved at: ${savedAt.toLocaleString()}`,
    `Mode: ${direction}`,
    "",
    "AI Summary",
    "",
    summary.trim(),
    "",
    translatedTitle,
    "",
    text.trim(),
    "",
    originalTitle,
    "",
    originalText.trim(),
  ];

  const cleanPartialText = partialText.trim();
  const cleanOriginalPartialText = originalPartialText.trim();
  if (cleanPartialText) {
    sections.push("", "In-progress translation partial", "", cleanPartialText);
  }
  if (cleanOriginalPartialText) {
    sections.push("", "In-progress original partial", "", cleanOriginalPartialText);
  }

  return sections.join("\n");
}
