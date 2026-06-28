/**
 * Detects the language/script of a text string using Unicode character ranges.
 * Returns an ISO 639-1 language code. No npm package needed.
 */

export interface DetectedLanguage {
  code: string;      // ISO 639-1 code e.g. "hi", "ar", "en"
  name: string;      // Human-readable e.g. "Hindi"
  font: string;      // Google Font name
  dir: "ltr" | "rtl";
  googleFontUrl: string;
}

const LANG_MAP: DetectedLanguage[] = [
  {
    code: "hi",
    name: "Hindi",
    font: "'Noto Sans Devanagari', sans-serif",
    dir: "ltr",
    googleFontUrl: "https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap",
  },
  {
    code: "ar",
    name: "Arabic",
    font: "'Noto Sans Arabic', sans-serif",
    dir: "rtl",
    googleFontUrl: "https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap",
  },
  {
    code: "ur",
    name: "Urdu",
    font: "'Noto Nastaliq Urdu', sans-serif",
    dir: "rtl",
    googleFontUrl: "https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;500;600;700&display=swap",
  },
  {
    code: "zh",
    name: "Chinese",
    font: "'Noto Sans SC', sans-serif",
    dir: "ltr",
    googleFontUrl: "https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700&display=swap",
  },
  {
    code: "ja",
    name: "Japanese",
    font: "'Noto Sans JP', sans-serif",
    dir: "ltr",
    googleFontUrl: "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700&display=swap",
  },
  {
    code: "ko",
    name: "Korean",
    font: "'Noto Sans KR', sans-serif",
    dir: "ltr",
    googleFontUrl: "https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&display=swap",
  },
  {
    code: "bn",
    name: "Bengali",
    font: "'Noto Sans Bengali', sans-serif",
    dir: "ltr",
    googleFontUrl: "https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;600;700&display=swap",
  },
  {
    code: "ta",
    name: "Tamil",
    font: "'Noto Sans Tamil', sans-serif",
    dir: "ltr",
    googleFontUrl: "https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;500;600;700&display=swap",
  },
  {
    code: "te",
    name: "Telugu",
    font: "'Noto Sans Telugu', sans-serif",
    dir: "ltr",
    googleFontUrl: "https://fonts.googleapis.com/css2?family=Noto+Sans+Telugu:wght@400;500;600;700&display=swap",
  },
  {
    code: "kn",
    name: "Kannada",
    font: "'Noto Sans Kannada', sans-serif",
    dir: "ltr",
    googleFontUrl: "https://fonts.googleapis.com/css2?family=Noto+Sans+Kannada:wght@400;500;600;700&display=swap",
  },
  {
    code: "gu",
    name: "Gujarati",
    font: "'Noto Sans Gujarati', sans-serif",
    dir: "ltr",
    googleFontUrl: "https://fonts.googleapis.com/css2?family=Noto+Sans+Gujarati:wght@400;500;600;700&display=swap",
  },
  {
    code: "pa",
    name: "Punjabi",
    font: "'Noto Sans Gurmukhi', sans-serif",
    dir: "ltr",
    googleFontUrl: "https://fonts.googleapis.com/css2?family=Noto+Sans+Gurmukhi:wght@400;500;600;700&display=swap",
  },
  {
    code: "ml",
    name: "Malayalam",
    font: "'Noto Sans Malayalam', sans-serif",
    dir: "ltr",
    googleFontUrl: "https://fonts.googleapis.com/css2?family=Noto+Sans+Malayalam:wght@400;500;600;700&display=swap",
  },
  {
    code: "th",
    name: "Thai",
    font: "'Noto Sans Thai', sans-serif",
    dir: "ltr",
    googleFontUrl: "https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&display=swap",
  },
  {
    code: "ru",
    name: "Russian",
    font: "'Noto Sans', sans-serif",
    dir: "ltr",
    googleFontUrl: "https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&display=swap",
  },
  {
    code: "he",
    name: "Hebrew",
    font: "'Noto Sans Hebrew', sans-serif",
    dir: "rtl",
    googleFontUrl: "https://fonts.googleapis.com/css2?family=Noto+Sans+Hebrew:wght@400;500;600;700&display=swap",
  },
  {
    code: "mr",
    name: "Marathi",
    font: "'Noto Sans Devanagari', sans-serif",
    dir: "ltr",
    googleFontUrl: "https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap",
  },
  {
    code: "as",
    name: "Assamese",
    font: "'Noto Sans Bengali', sans-serif",
    dir: "ltr",
    googleFontUrl: "https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;600;700&display=swap",
  },
  {
    code: "or",
    name: "Odia",
    font: "'Noto Sans Oriya', sans-serif",
    dir: "ltr",
    googleFontUrl: "https://fonts.googleapis.com/css2?family=Noto+Sans+Oriya:wght@400;500;600;700&display=swap",
  },
  {
    code: "de",
    name: "German",
    font: "'Noto Sans', sans-serif",
    dir: "ltr",
    googleFontUrl: "https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&display=swap",
  },
  {
    code: "en",
    name: "English",
    font: "var(--font-geist-sans), 'Inter', sans-serif",
    dir: "ltr",
    googleFontUrl: "",
  },
];

const ENGLISH_LANG = LANG_MAP.find((l) => l.code === "en")!;

/**
 * Count characters from a Unicode range in the text.
 */
function countInRange(text: string, start: number, end: number): number {
  let count = 0;
  for (const char of text) {
    const cp = char.codePointAt(0) ?? 0;
    if (cp >= start && cp <= end) count++;
  }
  return count;
}

/**
 * Detect language from text using Unicode character ranges.
 * Returns the best matching DetectedLanguage, defaulting to English.
 */
export function detectLanguage(text: string): DetectedLanguage {
  if (!text || text.trim().length === 0) return ENGLISH_LANG;

  const clean = text.trim();
  const len = clean.length;

  const scores: { lang: DetectedLanguage; count: number }[] = [
    // Devanagari — Hindi, Marathi, Nepali (U+0900–U+097F)
    { lang: LANG_MAP.find((l) => l.code === "hi")!, count: countInRange(clean, 0x0900, 0x097f) },
    // Arabic script (U+0600–U+06FF) — also covers Urdu
    { lang: LANG_MAP.find((l) => l.code === "ar")!, count: countInRange(clean, 0x0600, 0x06ff) },
    // CJK Unified Ideographs (U+4E00–U+9FFF) — Chinese/Japanese
    { lang: LANG_MAP.find((l) => l.code === "zh")!, count: countInRange(clean, 0x4e00, 0x9fff) },
    // Hiragana (U+3040–U+309F) / Katakana (U+30A0–U+30FF) — Japanese
    {
      lang: LANG_MAP.find((l) => l.code === "ja")!,
      count: countInRange(clean, 0x3040, 0x309f) + countInRange(clean, 0x30a0, 0x30ff),
    },
    // Hangul (U+AC00–U+D7AF) — Korean
    { lang: LANG_MAP.find((l) => l.code === "ko")!, count: countInRange(clean, 0xac00, 0xd7af) },
    // Bengali (U+0980–U+09FF)
    { lang: LANG_MAP.find((l) => l.code === "bn")!, count: countInRange(clean, 0x0980, 0x09ff) },
    // Tamil (U+0B80–U+0BFF)
    { lang: LANG_MAP.find((l) => l.code === "ta")!, count: countInRange(clean, 0x0b80, 0x0bff) },
    // Telugu (U+0C00–U+0C7F)
    { lang: LANG_MAP.find((l) => l.code === "te")!, count: countInRange(clean, 0x0c00, 0x0c7f) },
    // Kannada (U+0C80–U+0CFF)
    { lang: LANG_MAP.find((l) => l.code === "kn")!, count: countInRange(clean, 0x0c80, 0x0cff) },
    // Gujarati (U+0A80–U+0AFF)
    { lang: LANG_MAP.find((l) => l.code === "gu")!, count: countInRange(clean, 0x0a80, 0x0aff) },
    // Gurmukhi/Punjabi (U+0A00–U+0A7F)
    { lang: LANG_MAP.find((l) => l.code === "pa")!, count: countInRange(clean, 0x0a00, 0x0a7f) },
    // Malayalam (U+0D00–U+0D7F)
    { lang: LANG_MAP.find((l) => l.code === "ml")!, count: countInRange(clean, 0x0d00, 0x0d7f) },
    // Thai (U+0E00–U+0E7F)
    { lang: LANG_MAP.find((l) => l.code === "th")!, count: countInRange(clean, 0x0e00, 0x0e7f) },
    // Cyrillic (U+0400–U+04FF) — Russian
    { lang: LANG_MAP.find((l) => l.code === "ru")!, count: countInRange(clean, 0x0400, 0x04ff) },
    // Hebrew (U+0590–U+05FF)
    { lang: LANG_MAP.find((l) => l.code === "he")!, count: countInRange(clean, 0x0590, 0x05ff) },
  ];

  // Find the script with the most characters
  const best = scores.reduce((a, b) => (b.count > a.count ? b : a), { lang: ENGLISH_LANG, count: 0 });

  // Require at least 20% of the text to be non-Latin to switch language
  if (best.count / len < 0.2) return ENGLISH_LANG;

  // Refine: Arabic script — if Urdu-specific chars present, use Urdu
  if (best.lang.code === "ar") {
    const urduSpecific = countInRange(clean, 0x0679, 0x0699) + countInRange(clean, 0x06ba, 0x06be);
    if (urduSpecific > 0) return LANG_MAP.find((l) => l.code === "ur")!;
  }

  return best.lang;
}

export { LANG_MAP, ENGLISH_LANG };
