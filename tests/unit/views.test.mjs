import test from "node:test";
import assert from "node:assert/strict";
import { setLang } from "../../assets/js/core/i18n.js";
import * as P from "../../assets/js/views/pages.js";
import { terminal } from "../../assets/js/views/terminal.js";

const views = {
  home: P.home, dashboard: P.dashboard, workspaces: P.workspaces, files: P.files,
  marketplace: P.marketplace, commands: P.commands, osint: P.osint, labs: P.labs,
  ai: P.ai, admin: P.admin, settings: P.settings, signin: P.signin,
  status: P.status, denied: P.denied, notFound: P.notFound, terminal
};

test("all product routes render safely in Arabic and English", () => {
  for (const language of ["ar", "en"]) {
    setLang(language);
    for (const [name, view] of Object.entries(views)) {
      const rendered = view.render({ query: {}, role: "guest", rerender() {} });
      assert.equal(typeof rendered, "string", name + " must return HTML text");
      assert.ok(rendered.length > 40, name + " rendered an unexpectedly empty page");
      assert.doesNotMatch(rendered, /<script|javascript:/i, name + " must not emit scripts or javascript URLs");
      assert.doesNotMatch(rendered, /\sstyle\s*=/i, name + " must not emit inline styles");
      assert.doesNotMatch(rendered, /<[^>]*\son[a-z]+\s*=/i, name + " must not emit inline event handlers");
      const ids = [...rendered.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
      assert.equal(ids.length, new Set(ids).size, name + " contains duplicate element IDs");
    }
  }
});
