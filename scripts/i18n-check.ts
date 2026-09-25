/**
 * i18n check (CI): fails if the language files differ or if components contain hard-coded,
 * user-visible text.
 *
 *   pnpm i18n:check
 *
 * Messages: every locale has exactly the keys of en.json, no empty values, and the same
 * {placeholders} as English (so a translation can't drop the price or order number).
 * Components: JSX text, user-facing attributes (aria-label, placeholder, title, alt, label) and
 * toast messages must come from next-intl. Add `// i18n-ignore` (or `{/* i18n-ignore *\/}`) on the
 * line above for intentional exceptions (e.g. an example path).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { placeholders } from "../src/lib/i18n/icu";

const ROOT = path.resolve(import.meta.dirname, "..");
const LOCALES = ["en", "ta", "kn"] as const;
const errors: string[] = [];

// ───────────── Message files ─────────────

type Messages = { [key: string]: string | Messages };

function flatten(obj: Messages, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(full, value);
    else for (const [k, v] of flatten(value, full)) out.set(k, v);
  }
  return out;
}

const messages = Object.fromEntries(
  LOCALES.map((l) => [
    l,
    flatten(
      JSON.parse(readFileSync(path.join(ROOT, "src/messages", `${l}.json`), "utf8")) as Messages,
    ),
  ]),
) as Record<(typeof LOCALES)[number], Map<string, string>>;

const en = messages.en;
for (const locale of LOCALES) {
  const current = messages[locale];
  for (const key of en.keys()) {
    if (!current.has(key)) errors.push(`${locale}.json: missing "${key}"`);
  }
  for (const [key, value] of current) {
    if (!en.has(key)) {
      errors.push(`${locale}.json: extra key "${key}" (not in en.json)`);
      continue;
    }
    if (!value.trim() && en.get(key)!.trim()) errors.push(`${locale}.json: empty "${key}"`);
    const want = placeholders(en.get(key)!).join(",");
    const got = placeholders(value).join(",");
    if (locale !== "en" && want !== got) {
      errors.push(`${locale}.json: "${key}" uses {${got}} but en.json uses {${want}}`);
    }
  }
}

// ───────────── Hard-coded text in components ─────────────

const USER_FACING_ATTRS = new Set([
  "aria-label",
  "aria-description",
  "placeholder",
  "title",
  "alt",
  "label",
]);
const HAS_WORDS = /\p{L}{2,}/u;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "generated" ? [] : walk(full);
    return full.endsWith(".tsx") ? [full] : [];
  });
}

function ignored(source: ts.SourceFile, node: ts.Node): boolean {
  const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
  const lines = source.text.split("\n");
  return [lines[line], lines[line - 1]].some((l) => l?.includes("i18n-ignore"));
}

function report(source: ts.SourceFile, node: ts.Node, what: string, text: string) {
  if (ignored(source, node)) return;
  const { line, character } = source.getLineAndCharacterOfPosition(node.getStart(source));
  const file = path.relative(ROOT, source.fileName);
  errors.push(
    `${file}:${line + 1}:${character + 1} hard-coded ${what}: ${JSON.stringify(text.trim().slice(0, 60))}`,
  );
}

for (const file of walk(path.join(ROOT, "src"))) {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node) && HAS_WORDS.test(node.text)) {
      report(source, node, "JSX text", node.text);
    } else if (
      ts.isJsxAttribute(node) &&
      USER_FACING_ATTRS.has(node.name.getText(source)) &&
      node.initializer &&
      (ts.isStringLiteral(node.initializer) ||
        (ts.isJsxExpression(node.initializer) &&
          node.initializer.expression &&
          (ts.isStringLiteral(node.initializer.expression) ||
            ts.isNoSubstitutionTemplateLiteral(node.initializer.expression))))
    ) {
      const literal = ts.isStringLiteral(node.initializer)
        ? node.initializer
        : (node.initializer as ts.JsxExpression).expression!;
      const text = (literal as ts.StringLiteral).text;
      if (HAS_WORDS.test(text)) report(source, node, `${node.name.getText(source)}`, text);
    } else if (
      ts.isJsxExpression(node) &&
      node.expression &&
      (ts.isStringLiteral(node.expression) ||
        ts.isNoSubstitutionTemplateLiteral(node.expression)) &&
      ts.isJsxElement(node.parent) &&
      HAS_WORDS.test(node.expression.text)
    ) {
      report(source, node, "JSX string", node.expression.text);
    } else if (
      ts.isCallExpression(node) &&
      /^toast(\.\w+)?$/.test(node.expression.getText(source)) &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0]) &&
      HAS_WORDS.test(node.arguments[0].text)
    ) {
      report(source, node, "toast", node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

if (errors.length) {
  console.error(
    `i18n check failed (${errors.length}):\n${errors.map((e) => `  ✗ ${e}`).join("\n")}`,
  );
  process.exit(1);
}
console.log(
  `i18n check passed: ${en.size} keys × ${LOCALES.length} languages, no hard-coded text.`,
);
