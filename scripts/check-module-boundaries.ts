import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const normalize = (path: string) => path.replaceAll("\\", "/");

function violation(file: string, specifier: string): boolean {
  const target = specifier.startsWith("@/")
    ? normalize(relative(root, resolve(root, "src", specifier.slice(2))))
    : specifier.startsWith(".")
      ? normalize(relative(root, resolve(root, dirname(file), specifier)))
      : specifier;
  const match = /^src\/modules\/([^/]+)(?:\/(.+))?$/.exec(target);
  if (!match) return false;
  const [, module, internal] = match;
  if (!internal || /^index(?:\.[cm]?[jt]sx?)?$/.test(internal)) return true;
  if (file.startsWith(`src/modules/${module}/`)) return false;
  if (/\.test(?:\.[cm]?[jt]sx?)?$/.test(internal)) return true;
  return (
    /^ui\/(views|layouts)\//.test(internal) && !file.startsWith("src/app/")
  );
}

// Guard both alias and relative paths, including the explicit route exceptions.
assert.equal(
  violation("src/modules/payment/server/a.ts", "@/modules/tax"),
  true,
);
assert.equal(
  violation("src/modules/payment/server/a.ts", "@/modules/tax/util"),
  false,
);
assert.equal(violation("src/modules/tax/a.ts", "./util"), false);
assert.equal(violation("src/modules/payment/a.ts", "../tax/util"), false);
assert.equal(
  violation("src/app/a.tsx", "@/modules/tax/ui/views/tax-view"),
  false,
);
assert.equal(
  violation("src/app/a.tsx", "@/modules/tax/ui/components/form"),
  false,
);
assert.equal(violation("scripts/a.ts", "../src/modules/tax/util"), false);
assert.equal(
  violation("src/modules/tax/a.ts", "@/modules/tax/../payment/server/service"),
  false,
);
assert.equal(violation("src/modules/payment/a.ts", "../tax"), true);
assert.equal(violation("src/app/a.ts", "@/modules/tax/index.ts"), true);
assert.equal(violation("src/modules/tax/a.ts", "."), true);
assert.equal(
  violation("src/modules/payment/a.ts", "@/modules/tax/ui/views/tax-view"),
  true,
);
assert.equal(
  violation("scripts/a.ts", "../src/modules/tax/ui/layouts/nested/layout"),
  true,
);
assert.equal(violation("src/app/a.ts", "@/modules/tax/util.test.ts"), true);
assert.equal(violation("src/modules/payment/a.ts", "../tax/util.test"), true);
assert.equal(violation("src/modules/tax/a.test.ts", "./util.test"), false);

function files(directory: string): string[] {
  return readdirSync(resolve(root, directory), { withFileTypes: true }).flatMap(
    (entry) => {
      const path = `${directory}/${entry.name}`;
      if (path === "src/generated") return [];
      return entry.isDirectory()
        ? files(path)
        : /\.[cm]?[jt]sx?$/.test(path)
          ? [path]
          : [];
    },
  );
}

const errors: string[] = [];
const sources = [...files("src"), ...files("scripts")];
for (const file of sources) {
  const source = ts.createSourceFile(
    file,
    readFileSync(resolve(root, file), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  function visit(node: ts.Node) {
    let specifier: ts.Node | undefined;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      specifier = node.moduleSpecifier;
    else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require"))
    )
      specifier = node.arguments[0];
    else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument))
      specifier = node.argument.literal;
    if (
      specifier &&
      ts.isStringLiteralLike(specifier) &&
      violation(file, specifier.text)
    ) {
      const { line } = source.getLineAndCharacterOfPosition(
        specifier.getStart(source),
      );
      errors.push(`${file}:${line + 1}: ${specifier.text}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
if (errors.length) {
  console.error(`Module boundary violations:\n${errors.join("\n")}`);
  process.exitCode = 1;
} else console.log(`Module boundaries passed (${sources.length} files).`);
