export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function parseUuid(value) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new HttpError(400, "INVALID_ID", "A valid resource identifier is required");
  }
  return value;
}

export function parseLimit(value, fallback = 25) {
  if (value === null || value === undefined || value === "") return fallback;
  if (!/^[0-9]{1,3}$/.test(String(value))) throw new HttpError(400, "INVALID_LIMIT", "Invalid page size");
  const limit = Number(value);
  if (limit < 1 || limit > 100) throw new HttpError(400, "INVALID_LIMIT", "Page size must be between 1 and 100");
  return limit;
}

export function requireRole(role, allowed) {
  if (!allowed.includes(role)) throw new HttpError(403, "ROLE_REQUIRED", "This operation is not permitted");
}

export function encodeCursor(values) {
  return Buffer.from(JSON.stringify(values), "utf8").toString("base64url");
}

export function decodeCursor(value) {
  if (!value) return null;
  if (typeof value !== "string" || value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new HttpError(400, "INVALID_CURSOR", "Invalid page cursor");
  }
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object" || typeof parsed.time !== "string" || typeof parsed.id !== "string") {
      throw new Error("invalid cursor shape");
    }
    if (Number.isNaN(Date.parse(parsed.time)) || !/^[0-9a-f-]{36}$/i.test(parsed.id)) {
      throw new Error("invalid cursor values");
    }
    return parsed;
  } catch {
    throw new HttpError(400, "INVALID_CURSOR", "Invalid page cursor");
  }
}
