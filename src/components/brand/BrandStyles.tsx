import { brand } from "@/config/brand";
import { buildBrandCss } from "@/lib/brandCss";

export function BrandStyles() {
  const css = buildBrandCss(brand);
  return <style id="brand-theme" dangerouslySetInnerHTML={{ __html: css }} />;
}
