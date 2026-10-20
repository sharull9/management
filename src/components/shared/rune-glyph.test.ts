import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RuneGlyph } from "./rune-glyph";
import { type RuneGlyphName, runeGlyphs } from "./rune-icons.generated";

test("repeated glyphs keep gradients, masks and filters local to each instance", () => {
  const names = Object.keys(runeGlyphs) as RuneGlyphName[];
  const markup = renderToStaticMarkup(
    createElement(
      "div",
      null,
      ...names.flatMap((name) => [
        createElement(RuneGlyph, { name, key: `${name}-inactive` }),
        createElement(RuneGlyph, { name, key: `${name}-active` }),
      ]),
    ),
  );
  const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(ids.length > 0);
  assert.equal(
    new Set(ids).size,
    ids.length,
    "SVG IDs must be unique across instances",
  );

  for (const [svg] of markup.matchAll(/<svg\b[^>]*>[\s\S]*?<\/svg>/g)) {
    const localIds = new Set(
      [...svg.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]),
    );
    for (const [, id] of svg.matchAll(/url\(#([^)]+)\)/g)) {
      assert.ok(
        localIds.has(id),
        `SVG reference ${id} must resolve within its own icon`,
      );
    }
  }
});
