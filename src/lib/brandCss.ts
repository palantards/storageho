import type { BrandConfig, ThemeTokens } from "@/config/brand";

function toKebabCase(input: string): string {
  return input.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

function tokensToCssVars(tokens: ThemeTokens): string {
  return Object.entries(tokens)
    .map(([key, value]) => `  --${toKebabCase(key)}: ${value};`)
    .join("\n");
}

export function buildBrandCss(brand: BrandConfig): string {
  const { light, dark } = brand.theme;

  const radiusCss = [
    `  --radius-sm: ${brand.theme.radius.sm};`,
    `  --radius-md: ${brand.theme.radius.md};`,
    `  --radius-lg: ${brand.theme.radius.lg};`,
  ].join("\n");

  const fontsCss = [
    `  --font-sans-stack: ${brand.typography.fontSans};`,
    `  --font-mono-stack: ${brand.typography.fontMono};`,
  ].join("\n");

  return `
:root {
${fontsCss}
${radiusCss}
${tokensToCssVars(light)}
  color-scheme: light;
}

.dark {
${tokensToCssVars(dark)}
  color-scheme: dark;
}
`.trim();
}

