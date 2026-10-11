import { cn } from "@/lib/utils";
import { type RuneGlyphName, runeGlyphs } from "./rune-icons.generated";

/** RuneIcons glass glyph; keeps its own colours, so `color` has no effect. */
export function RuneGlyph({
  name,
  className,
}: {
  name: RuneGlyphName;
  className?: string;
}) {
  const glyph = runeGlyphs[name];
  return (
    <svg
      aria-hidden
      viewBox={glyph.viewBox}
      className={cn("size-4 shrink-0", className)}
      // Markup is generated at build time from the runeicons-react package.
      // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted, generated SVG
      dangerouslySetInnerHTML={{ __html: glyph.markup }}
    />
  );
}
