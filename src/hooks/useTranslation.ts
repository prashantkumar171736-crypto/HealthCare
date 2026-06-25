"use client";

import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/context/LanguageContext";

/**
 * useTranslation — translates a fixed set of UI strings whenever the language changes.
 *
 * Usage:
 *   const { t } = useTranslation({ home: "Home", diseases: "Diseases" });
 *   <span>{t("home")}</span>
 */
export function useTranslation<T extends Record<string, string>>(
  strings: T
): { t: (key: keyof T) => string; isReady: boolean } {
  const { lang, translate } = useLanguage();
  const [translated, setTranslated] = useState<T>(strings);
  const [isReady, setIsReady] = useState(lang.code === "en");
  const prevLangRef = useRef(lang.code);

  useEffect(() => {
    if (lang.code === "en") {
      setTranslated(strings);
      setIsReady(true);
      prevLangRef.current = "en";
      return;
    }

    if (prevLangRef.current === lang.code) return;

    const keys = Object.keys(strings) as (keyof T)[];
    const values = keys.map((k) => strings[k]);

    setIsReady(false);

    translate(values).then((results) => {
      const next = { ...strings };
      keys.forEach((k, i) => {
        next[k] = results[i] as T[keyof T];
      });
      setTranslated(next);
      prevLangRef.current = lang.code;
      setIsReady(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang.code]);

  const t = (key: keyof T): string => translated[key];

  return { t, isReady };
}
