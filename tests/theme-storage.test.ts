import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_THEME, normalizeStoredTheme } from "../src/app/admin/ThemeSettings";

test("dark preset theme from storage is preserved", () => {
  const savedTheme = {
    bgColor: "#071924",
    sidebarColor: "#05111a",
    cardColor: "#081520",
    accentColor: "#00e5ff",
    textPrimary: "#f0fdff",
    textSecondary: "#95c0d1",
    autoAdjust: false,
  };

  assert.deepEqual(normalizeStoredTheme(savedTheme), {
    ...DEFAULT_THEME,
    ...savedTheme,
  });
});

test("invalid stored theme falls back to default", () => {
  assert.deepEqual(normalizeStoredTheme({ bgColor: "#12345" }), DEFAULT_THEME);
});
