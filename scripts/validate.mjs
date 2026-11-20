import { readFileSync, existsSync } from "node:fs";
import { strict as assert } from "node:assert";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const html = read("index.html");
const css = read("assets/styles.css");
const js = read("assets/app.js");
const openapi = read("openapi/cornod-v1.yaml");

assert.match(html, /<html lang="ar" dir="rtl">/, "Arabic RTL must be the default");
assert.match(html, /name="robots" content="noindex,nofollow,noarchive"/, "Preview must discourage indexing");
assert.match(html, /assets\/styles\.css/);
assert.match(html, /assets\/app\.js/);
assert.match(html, /data-view="overview"/);
assert.match(html, /data-view="terminal"/);
assert.match(html, /executionDisabled/);
assert.match(js, /COMMAND EXECUTION DISABLED/);
assert.match(js, /function go\(page/);
assert.match(js, /event\.key==="Escape"/, "Escape must close the mobile navigation");
assert.ok(css.length > 3000, "Stylesheet unexpectedly small");

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(ids.length, new Set(ids).size, "HTML IDs must be unique");

const views = new Set([...html.matchAll(/data-view="([^"]+)"/g)].map((match) => match[1]));
for (const page of [...html.matchAll(/data-page="([^"]+)"/g)].map((match) => match[1])) {
  assert.ok(views.has(page), `Navigation target "${page}" has no matching view`);
}
for (const href of [...html.matchAll(/href="#([^"]+)"/g)].map((match) => match[1])) {
  if (views.has(href)) continue;
  assert.ok(ids.includes(href), `Internal link "#${href}" has no matching element ID`);
}

assert.doesNotMatch(html, /<script[^>]+src=["']https?:\/\//i, "Frontend must not load unreviewed remote scripts");
assert.doesNotMatch(html + js + css, /service_role|sb_secret_|SUPABASE_SERVICE_ROLE_KEY|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/i, "Privileged secret pattern found in frontend");
assert.match(openapi, /^openapi: 3\\.1\\.0/m, "OpenAPI contract must declare version 3.1.0");
assert.match(openapi, /additionalProperties: false/, "Request schemas must explicitly reject unknown fields");
assert.match(openapi, /terminal-tickets/, "Terminal ticket contract is missing");
for (const path of ["docs/ARCHITECTURE.md", "docs/THREAT-MODEL.md", "docs/ROADMAP.md", "docs/API-CONTRACT.md", "docs/AUTHORIZATION-MATRIX.md", "docs/DATA-MODEL.md", "docs/SECURITY-ACCEPTANCE.md"]) {
  assert.ok(existsSync(new URL("../" + path, import.meta.url)), path + " missing");
}
console.log("CORNOD static, navigation and security guardrail checks passed.");
