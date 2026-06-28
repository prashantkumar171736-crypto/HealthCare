"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { detectLanguage, DetectedLanguage, ENGLISH_LANG, LANG_MAP } from "@/lib/detectLanguage";

const STORAGE_KEY = "healthedu_lang";

interface LanguageContextValue {
  lang: DetectedLanguage;
  setLangFromText: (text: string) => void;
  resetToEnglish: () => void;
  setLangByCode: (code: string) => void;
  isTranslating: boolean;
  translate: (texts: string[]) => Promise<string[]>;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: ENGLISH_LANG,
  setLangFromText: () => {},
  setLangByCode: () => {},
  resetToEnglish: () => {},
  isTranslating: false,
  translate: async (t) => t,
});

// In-memory translation cache: "langCode:original" -> translated
const translationCache = new Map<string, string>();

function loadFont(lang: DetectedLanguage) {
  if (!lang.googleFontUrl) return;
  const id = `font-${lang.code}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = lang.googleFontUrl;
  document.head.appendChild(link);
}

function applyLang(lang: DetectedLanguage) {
  const root = document.documentElement;
  root.setAttribute("lang", lang.code);
  root.setAttribute("dir", lang.dir);
  root.style.setProperty("--font-content", lang.font);
  if (lang.code !== "en") {
    loadFont(lang);
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<DetectedLanguage>(ENGLISH_LANG);
  const [isTranslating, setIsTranslating] = useState(false);
  const pendingRef = useRef<AbortController | null>(null);

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: DetectedLanguage = JSON.parse(saved);
        setLang(parsed);
        applyLang(parsed);
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  const setLangFromText = useCallback((text: string) => {
    const detected = detectLanguage(text);
    setLang((prev) => {
      if (prev.code === detected.code) return prev;
      applyLang(detected);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(detected));
      } catch {}
      return detected;
    });
  }, []);

  const resetToEnglish = useCallback(() => {
    setLang(ENGLISH_LANG);
    applyLang(ENGLISH_LANG);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  /**
   * Translate an array of strings to the current language.
   * Returns the originals if already English.
   * Uses in-memory cache to avoid redundant API calls.
   */
  const translate = useCallback(
    async (texts: string[]): Promise<string[]> => {
      if (lang.code === "en") return texts;

      // Check cache first
      const results: (string | null)[] = texts.map((t) => {
        const key = `${lang.code}:${t}`;
        return translationCache.get(key) ?? null;
      });

      const uncachedIndices = results
        .map((r, i) => (r === null ? i : -1))
        .filter((i) => i !== -1);

      if (uncachedIndices.length === 0) {
        return results as string[];
      }

      const uncachedTexts = uncachedIndices.map((i) => texts[i]);

      // Cancel any in-flight request
      if (pendingRef.current) pendingRef.current.abort();
      const controller = new AbortController();
      pendingRef.current = controller;

      setIsTranslating(true);
      try {
        const res = await fetch(
          `/api/translate?to=${lang.code}&texts=${encodeURIComponent(JSON.stringify(uncachedTexts))}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("Translation failed");
        const data: { translations: string[] } = await res.json();

        // Populate cache and results
        uncachedIndices.forEach((origIdx, i) => {
          const translated = data.translations[i] ?? texts[origIdx];
          const key = `${lang.code}:${texts[origIdx]}`;
          translationCache.set(key, translated);
          results[origIdx] = translated;
        });
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.warn("Translation error, falling back to original:", err);
        }
        // Fall back to originals for uncached items
        uncachedIndices.forEach((origIdx) => {
          if (results[origIdx] === null) results[origIdx] = texts[origIdx];
        });
      } finally {
        setIsTranslating(false);
      }

      return results as string[];
    },
    [lang.code]
  );

  const setLangByCode = useCallback((code: string) => {
    const found = LANG_MAP.find((l) => l.code === code);
    if (!found) return;
    setLang((prev) => {
      if (prev.code === found.code) return prev;
      applyLang(found);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(found));
      } catch {}
      return found;
    });
  }, []);

  return (
    <LanguageContext.Provider value={{ lang, setLangFromText, setLangByCode, resetToEnglish, isTranslating, translate }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
