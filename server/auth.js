import { createRemoteJWKSet, jwtVerify } from "jose";

export function createTokenVerifier(config) {
  const jwks = createRemoteJWKSet(new URL(config.oidcJwksUrl), {
    timeoutDuration: 5_000,
    cooldownDuration: 30_000,
    cacheMaxAge: 10 * 60_000
  });

  return async function verifyAccessToken(token) {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: config.oidcIssuer,
      audience: config.oidcAudience,
      algorithms: ["RS256", "ES256"],
      maxTokenAge: "15 minutes",
      clockTolerance: 5
    });

    if (typeof payload.sub !== "string" || !payload.sub || typeof payload.iss !== "string") {
      throw new Error("Invalid access-token subject");
    }
    const scopes = typeof payload.scope === "string"
      ? payload.scope.split(/\s+/)
      : Array.isArray(payload.scp) ? payload.scp : [];
    if (config.oidcRequiredRole) {
      // Supabase Auth access JWTs use role=authenticated and aud=authenticated.
      // Never treat an anon/service_role token as a user. Tenant authorization
      // remains server-owned and is checked against database membership.
      if (payload.role !== config.oidcRequiredRole) {
        throw new Error("Authenticated user role is required");
      }
    } else if (!scopes.includes(config.oidcRequiredScope)) {
      throw new Error("Required API scope is missing");
    }

    return {
      issuer: payload.iss,
      subject: payload.sub,
      email: typeof payload.email === "string" ? payload.email : null,
      displayName: typeof payload.name === "string"
        ? payload.name
        : typeof payload.preferred_username === "string" ? payload.preferred_username : null
    };
  };
}
