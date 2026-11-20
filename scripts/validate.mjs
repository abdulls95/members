import { readFileSync, existsSync } from "node:fs";
import { strict as assert } from "node:assert";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const html = read("index.html");
const css = read("assets/css/cornod.css");
const app = read("assets/js/app.js");
const terminal = read("assets/js/views/terminal.js");
const terminalAdapter = read("assets/js/terminal/adapters.js");
const terminalController = read("assets/js/terminal/controller.js");
const config = read("assets/js/core/config.js");
const store = read("assets/js/core/store.js");
const pages = read("assets/js/views/pages.js");
const catalog = read("assets/js/data/catalog.js");
const openapi = read("openapi/cornod-v1.yaml");

assert.match(html, /<html lang="ar" dir="rtl">/, "Arabic RTL must be the default");
assert.match(html, /name="robots" content="noindex,nofollow,noarchive"/, "Preview must discourage indexing");
assert.match(html, /name="referrer" content="strict-origin-when-cross-origin"/, "Referrer policy must be explicit");
assert.match(html, /Content-Security-Policy/, "A restrictive frontend CSP must be present");
assert.match(html, /style-src 'self'/, "Inline styles must remain disabled by CSP");
assert.doesNotMatch(html, /unsafe-inline|https: wss:/, "Preview CSP must not allow broad inline or remote connections");
assert.match(html, /id="main"/, "Accessible application main landmark is required");
assert.match(html, /assets\/css\/cornod\.css/);
assert.match(html, /assets\/js\/app\.js/);
assert.match(html, /type="module"/);
assert.ok(css.length > 5000, "Industrial stylesheet unexpectedly small");

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(ids.length, new Set(ids).size, "HTML IDs must be unique");
assert.match(app, /export const ROUTES/);
for (const route of ["/dashboard", "/workspaces", "/terminal", "/files", "/marketplace", "/commands", "/ai", "/osint", "/labs", "/admin", "/settings", "/signin"]) {
  assert.ok(app.includes("path: '" + route + "'"), "Missing UI route " + route);
}
assert.match(app, /Escape/, "Escape must close mobile navigation");
assert.match(app, /UI gating only; the API enforces for real/, "Client-side role gating must not be represented as security");

assert.match(terminal, /new DisconnectedAdapter\(\)/, "Terminal must use disconnected adapter without backend config");
assert.match(terminalAdapter, /NO_BACKEND/, "Disconnected terminal must report no backend");
assert.match(terminalController, /NOT_CONNECTED/, "Terminal must explicitly say disconnected commands are not executed");
assert.match(config, /apiBase: null/);
assert.match(config, /wsBase: null/);

assert.match(store, /lang: 'ar', previewRole: 'guest'/, "Only non-sensitive preview preferences may persist");
assert.doesNotMatch(pages, /\sstyle\s*=/i, "UI templates must not use inline style attributes");
assert.doesNotMatch(pages, /\son[a-z]+\s*=/i, "UI templates must not use inline event handlers");
assert.match(catalog, /Sherlock/i, "Curated tool catalogue should include Sherlock");

assert.doesNotMatch(html, /<script[^>]+src=["']https?:\/\//i, "Frontend must not load unreviewed remote scripts");
assert.doesNotMatch(app + terminal + terminalAdapter + terminalController + pages, /\beval\s*\(|new Function\s*\(/, "Dynamic code evaluation is forbidden");
assert.doesNotMatch(html + css + app + terminal + pages, /service_role|sb_secret_|SUPABASE_SERVICE_ROLE_KEY|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/i, "Privileged secret pattern found in frontend");
assert.match(openapi, /^openapi: 3[.]1[.]0/m, "OpenAPI contract must declare version 3.1.0");
assert.match(openapi, /additionalProperties: false/, "Request schemas must explicitly reject unknown fields");
assert.match(openapi, /workspace-jobs/, "Workspace job status contract is missing");
assert.match(openapi, /bearerAuth/, "OpenAPI must match OIDC bearer authentication");
for (const path of [
  "docs/ARCHITECTURE.md", "docs/THREAT-MODEL.md", "docs/ROADMAP.md",
  "docs/API-CONTRACT.md", "docs/AUTHORIZATION-MATRIX.md", "docs/DATA-MODEL.md",
  "docs/SECURITY-ACCEPTANCE.md", "docs/WORKER-QUEUE.md"
]) {
  assert.ok(existsSync(new URL("../" + path, import.meta.url)), path + " missing");
}
console.log("CORNOD UI, route, terminal safety and security guardrail checks passed.");
