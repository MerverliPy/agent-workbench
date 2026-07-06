// @ts-nocheck
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const CSS_PATH = path.resolve(import.meta.dirname, "index.css");
const css = readFileSync(CSS_PATH, "utf-8");

describe("Design tokens (OKLCH)", () => {
  it("should define light theme CSS custom properties on :root", () => {
    expect(css).toContain("--bg:");
    expect(css).toContain("--surface:");
    expect(css).toContain("--fg:");
    expect(css).toContain("--accent:");
    expect(css).toContain("--muted:");
    expect(css).toContain("--border:");
    expect(css).toContain("--success:");
    expect(css).toContain("--danger:");
    expect(css).toContain("--code-bg:");
    expect(css).toContain("--safe-top:");
    expect(css).toContain("--topbar-h:");
  });

  it("should use oklch color space for tokens", () => {
    // All --color-* in @theme should use oklch()
    const themeBlock = css.match(/@theme \{([^}]+)\}/)?.[1] ?? "";
    const colorLines = themeBlock.match(/--color-[^:]+:[^;]+;/g) ?? [];
    for (const line of colorLines) {
      // rgba and hex values are allowed for border/soft variants
      if (line.includes("rgba") || line.includes("#")) continue;
      expect(line).toMatch(/oklch/);
    }
  });

  it("should define dark mode overrides in html.dark", () => {
    expect(css).toContain("html.dark {");
    expect(css).toContain("--bg: oklch(14% 0.008 255);");
    expect(css).toContain("--surface: oklch(18% 0.01 255);");
  });

  it("should define prefers-color-scheme: dark auto mode", () => {
    expect(css).toContain("@media (prefers-color-scheme: dark)");
    expect(css).toContain("html:not(.light)");
  });
});

describe("Keyframe animations", () => {
  it("should define @keyframes msgIn", () => {
    expect(css).toContain("@keyframes msgIn");
    expect(css).toContain("translateY(6px)");
  });

  it("should define @keyframes blink", () => {
    expect(css).toContain("@keyframes blink");
  });

  it("should define @keyframes dotBounce", () => {
    expect(css).toContain("@keyframes dotBounce");
    expect(css).toContain("translateY(-5px)");
  });

  it("should define @keyframes connection-pulse", () => {
    expect(css).toContain("@keyframes connection-pulse");
  });

  it("should define @keyframes fade-in", () => {
    expect(css).toContain("@keyframes fade-in");
  });
});

describe("Reduced motion", () => {
  it("should respect prefers-reduced-motion", () => {
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("animation-duration: 0.01ms;");
  });
});

describe("Safe area", () => {
  it("should define safe-top and safe-bottom classes", () => {
    expect(css).toContain(".safe-top");
    expect(css).toContain(".safe-bottom");
    expect(css).toContain("env(safe-area-inset-top");
    expect(css).toContain("env(safe-area-inset-bottom");
  });
});

describe("Typography tokens", () => {
  it("should define the type scale tokens", () => {
    expect(css).toContain("--font-display:");
    expect(css).toContain("--font-body:");
    expect(css).toContain("--font-mono:");
    expect(css).toContain("SF Pro");
    expect(css).toContain("JetBrains Mono");
  });
});
