import type { SttSessionConfig } from "@soniox/client";
import type { CaptionMode } from "./live-caption-types";

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

export function createSessionConfig(mode: CaptionMode): SttSessionConfig {
  return {
    model: "stt-rt-v5",
    language_hints: [mode === "en-ko" ? "en" : "ko"],
    language_hints_strict: true,
    enable_endpoint_detection: true,
    max_endpoint_delay_ms: 1500,
    endpoint_sensitivity: 0,
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
  };
}
