export type CaptionMode = "en-ko" | "ko-en";

export type CaptionSnapshot = {
  mode: CaptionMode;
  originalPartialText: string;
  originalText: string;
  partialText: string;
  text: string;
};
