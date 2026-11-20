import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "./config.js";

const base = {
  DATABASE_URL: "postgresql://cornod:local-only@127.0.0.1:5432/cornod",
  OIDC_ISSUER: "https://identity.example.invalid",
  OIDC_AUDIENCE: "cornod-api",
  OIDC_JWKS_URL: "https://identity.example.invalid/.well-known/jwks.json",
  OIDC_REQUIRED_SCOPE: "cornod:api",
  CORS_ORIGINS: "http://localhost:3000",
  NODE_ENV: "development"
};

test("configuration loads with explicit development settings", () => {
  const config = loadConfig(base);
  assert.equal(config.port, 8080);
  assert.equal(config.databaseSsl, "disable");
  assert.equal(config.corsOrigins.has("http://localhost:3000"), true);
});

test("configuration fails closed when required identity settings are missing", () => {
  assert.throws(() => loadConfig({ ...base, OIDC_JWKS_URL: "" }), /OIDC_JWKS_URL/);
});

test("production requires database TLS and HTTPS browser origins", () => {
  assert.throws(() => loadConfig({ ...base, NODE_ENV: "production", DATABASE_SSL: "disable", CORS_ORIGINS: "https://app.example.invalid" }), /must require TLS/);
  assert.throws(() => loadConfig({ ...base, NODE_ENV: "production", DATABASE_SSL: "require" }), /HTTPS origins/);
  assert.doesNotThrow(() => loadConfig({ ...base, NODE_ENV: "production", DATABASE_SSL: "require", CORS_ORIGINS: "https://app.example.invalid" }));
});
