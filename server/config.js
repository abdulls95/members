const required = ["DATABASE_URL", "OIDC_ISSUER", "OIDC_AUDIENCE", "OIDC_JWKS_URL", "CORS_ORIGINS"];

export function loadConfig(env = process.env) {
  const missing = required.filter((key) => !String(env[key] || "").trim());
  if (missing.length) throw new Error("Missing required environment variables: " + missing.join(", "));

  const requiredScope = String(env.OIDC_REQUIRED_SCOPE || "").trim();
  const requiredRole = String(env.OIDC_REQUIRED_ROLE || "").trim();
  if (Boolean(requiredScope) === Boolean(requiredRole)) {
    throw new Error("Configure exactly one of OIDC_REQUIRED_SCOPE or OIDC_REQUIRED_ROLE");
  }
  if (requiredRole && requiredRole !== "authenticated") {
    throw new Error("OIDC_REQUIRED_ROLE only supports authenticated user JWTs");
  }

  const databaseUrl = new URL(env.DATABASE_URL);
  if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol)) {
    throw new Error("DATABASE_URL must use the PostgreSQL protocol");
  }

  const issuer = new URL(env.OIDC_ISSUER);
  const jwks = new URL(env.OIDC_JWKS_URL);
  if (issuer.protocol !== "https:" || jwks.protocol !== "https:") {
    throw new Error("OIDC issuer and JWKS endpoints must use HTTPS");
  }

  const nodeEnv = env.NODE_ENV || "development";
  const databaseSsl = env.DATABASE_SSL || (nodeEnv === "production" ? "require" : "disable");
  if (!["require", "disable"].includes(databaseSsl)) throw new Error("DATABASE_SSL must be require or disable");
  if (nodeEnv === "production" && databaseSsl !== "require") {
    throw new Error("Production database connections must require TLS");
  }

  const corsOrigins = env.CORS_ORIGINS.split(",").map((value) => value.trim()).filter(Boolean);
  if (!corsOrigins.length) throw new Error("At least one CORS origin is required");
  for (const value of corsOrigins) {
    const origin = new URL(value);
    if (origin.origin !== value || (nodeEnv === "production" && origin.protocol !== "https:")) {
      throw new Error("CORS_ORIGINS must contain exact HTTPS origins in production");
    }
  }

  return Object.freeze({
    nodeEnv,
    port: Number(env.PORT || 8080),
    databaseUrl: env.DATABASE_URL,
    databaseSsl,
    oidcIssuer: issuer.origin === env.OIDC_ISSUER ? issuer.href.replace(/\/$/, "") : env.OIDC_ISSUER.replace(/\/$/, ""),
    oidcAudience: env.OIDC_AUDIENCE,
    oidcJwksUrl: jwks.href,
    oidcRequiredScope: requiredScope,
    oidcRequiredRole: requiredRole,
    corsOrigins: new Set(corsOrigins),
    trustProxy: env.TRUST_PROXY === "true"
  });
}
