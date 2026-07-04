"use client";

import { useEffect, useRef } from "react";
import { useLanguage } from "@/context/LanguageContext";

// Elements whose text should NOT be translated
const SKIP_SELECTORS = [
  "script",
  "style",
  "noscript",
  "code",
  "pre",
  "textarea",
  "input",
  "select",
  "option",
  "[data-no-translate]",
  ".navbar-wrapper",   // Navbar handles its own translation
];

// Collect all leaf text nodes within `root`, skipping skippable elements
function collectTextNodes(root: Element): Text[] {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;

        // Skip elements that match skip selectors
        for (const sel of SKIP_SELECTORS) {
          if (parent.closest(sel)) return NodeFilter.FILTER_REJECT;
        }

        // Skip empty / whitespace-only text nodes
        if (!node.nodeValue || node.nodeValue.trim() === "") {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  const nodes: Text[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) {
    nodes.push(n as Text);
  }
  return nodes;
}

// Batch texts into groups of `size` (to avoid huge single API calls)
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// In-memory cache: "langCode:originalText" -> translatedText
const cache = new Map<string, string>();

async function translateBatch(texts: string[], targetLang: string): Promise<string[]> {
  // Check cache first
  const results: (string | null)[] = texts.map((t) => {
    const key = `${targetLang}:${t}`;
    return cache.get(key) ?? null;
  });

  const uncachedIndices = results
    .map((r, i) => (r === null ? i : -1))
    .filter((i) => i !== -1);

  if (uncachedIndices.length === 0) return results as string[];

  const uncachedTexts = uncachedIndices.map((i) => texts[i]);

  try {
    const res = await fetch(
      `/api/translate?to=${targetLang}&texts=${encodeURIComponent(JSON.stringify(uncachedTexts))}`
    );
    if (!res.ok) throw new Error("Translation failed");
    const data: { translations: string[] } = await res.json();

    uncachedIndices.forEach((origIdx, i) => {
      const translated = data.translations[i] ?? texts[origIdx];
      cache.set(`${targetLang}:${texts[origIdx]}`, translated);
      results[origIdx] = translated;
    });
  } catch {
    // Fall back to originals
    uncachedIndices.forEach((origIdx) => {
      if (results[origIdx] === null) results[origIdx] = texts[origIdx];
    });
  }

  return results as string[];
}

export default function PageTranslator() {
  const { lang } = useLanguage();
  // Always start from "en" as the base so originals are stored correctly on first render,
  // even when the default language is not English (e.g. Hindi).
  const langRef = useRef("en");
  // Store original text for each node so we can restore English
  const originalsRef = useRef<Map<Text, string>>(new Map());
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const prevLang = langRef.current;
    langRef.current = lang.code;

    // Cancel any in-flight translation
    if (abortRef.current) {
      abortRef.current.abort();
    }

    // If switching back to English (original content language), restore originals
    if (lang.code === "en") {
      originalsRef.current.forEach((original, node) => {
        if (node.isConnected) node.nodeValue = original;
      });
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    async function run() {
      // Target the main content area (skip navbar)
      const mainEl = document.querySelector("main");
      if (!mainEl) return;

      const textNodes = collectTextNodes(mainEl as Element);

      // Store originals on first encounter (or when switching away from English)
      if (prevLang === "en") {
        textNodes.forEach((node) => {
          if (!originalsRef.current.has(node)) {
            originalsRef.current.set(node, node.nodeValue ?? "");
          }
        });
      }

      // Get current text (may already be translated to a prior language)
      // Always translate from the stored original to avoid re-translating translated text
      const nodesToTranslate: Text[] = [];
      const textsToTranslate: string[] = [];

      textNodes.forEach((node) => {
        // Use stored original if available, otherwise current value
        const original = originalsRef.current.get(node) ?? node.nodeValue ?? "";
        if (!original.trim()) return;

        // Store original if not stored yet
        if (!originalsRef.current.has(node)) {
          originalsRef.current.set(node, original);
        }

        nodesToTranslate.push(node);
        textsToTranslate.push(original);
      });

      if (nodesToTranslate.length === 0) return;

      // Process in chunks of 50 to avoid too-large URLs
      const chunks = chunkArray(
        nodesToTranslate.map((node, i) => ({ node, text: textsToTranslate[i] })),
        50
      );

      for (const chunk of chunks) {
        if (controller.signal.aborted) return;

        const texts = chunk.map((c) => c.text);
        const translated = await translateBatch(texts, lang.code);

        if (controller.signal.aborted) return;

        chunk.forEach(({ node }, i) => {
          if (node.isConnected && translated[i]) {
            node.nodeValue = translated[i];
          }
        });
      }
    }

    run();

    return () => {
      controller.abort();
    };
  }, [lang.code]);

  return null; // Renders nothing – purely side-effectful
}
