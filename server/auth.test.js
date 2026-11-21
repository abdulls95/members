import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { createTokenVerifier } from "./auth.js";

test("Supabase role verification allows authenticated people but denies anon and service_role", async (t) => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  Object.assign(jwk, { kid: "cornod-role-test", alg: "RS256", use: "sig" });
  const server = createServer((_req, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ keys: [jwk] }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const issuer = "https://example.supabase.co/auth/v1";
  const verifier = createTokenVerifier({
    oidcIssuer: issuer,
    oidcAudience: "authenticated",
    oidcJwksUrl: `http://127.0.0.1:${server.address().port}/jwks.json`,
    oidcRequiredScope: "",
    oidcRequiredRole: "authenticated"
  });
  async function makeToken(role) {
    return new SignJWT({ role, email: "test@example.invalid" })
      .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
      .setIssuer(issuer).setAudience("authenticated")
      .setSubject("00000000-0000-4000-8000-000000000001")
      .setIssuedAt().setExpirationTime("5m").sign(privateKey);
  }
  const valid = await verifier(await makeToken("authenticated"));
  assert.equal(valid.subject, "00000000-0000-4000-8000-000000000001");
  await assert.rejects(verifier(await makeToken("anon")), /Authenticated user role/);
  await assert.rejects(verifier(await makeToken("service_role")), /Authenticated user role/);
  const wrongAudience = await new SignJWT({ role: "authenticated" })
    .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
    .setIssuer(issuer).setAudience("not-authenticated")
    .setSubject("00000000-0000-4000-8000-000000000001")
    .setIssuedAt().setExpirationTime("5m").sign(privateKey);
  await assert.rejects(verifier(wrongAudience));
});
