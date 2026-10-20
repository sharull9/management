import { useId } from "react";
import { cn } from "@/lib/utils";
import { type RuneGlyphName, runeGlyphs } from "./rune-icons.generated";

/** RuneIcons glass glyph; tinted with the parent's `--glyph-*` variables. */
export function RuneGlyph({
  name,
  className,
}: {
  name: RuneGlyphName;
  className?: string;
}) {
  const id = useId();
  const glyph = runeGlyphs[name];
  // SVG IDs are document-wide; repeated glyphs must not share paint servers.
  const markup = glyph.markup
    .replace(/\bid="([^"]+)"/g, `id="${id}-$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${id}-$1)`);
  return (
    <svg
      aria-hidden
      viewBox={glyph.viewBox}
      className={cn("size-4 shrink-0", className)}
      // Markup is generated at build time from the runeicons-react package.
      // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted, generated SVG
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
