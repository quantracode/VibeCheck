// VC-CONFIG-002: Insecure default for critical secret
export const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-123";

// VC-CONFIG-002: Another insecure default
export const SESSION_SECRET = process.env.SESSION_SECRET ?? "session-dev";

// Safe - not a secret
export const API_URL = process.env.API_URL || "http://localhost:3000";
