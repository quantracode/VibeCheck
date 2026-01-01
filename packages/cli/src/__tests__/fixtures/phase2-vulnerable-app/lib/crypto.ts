import crypto from "crypto";
import jwt from "jsonwebtoken";

// VC-CRYPTO-001: Math.random for tokens
export function generateToken() {
  // Vulnerable: Using Math.random for security token
  const token = Math.random().toString(36).substring(2);
  return token;
}

export function generateSessionKey() {
  // Vulnerable: Math.random in key generation
  const key = Math.random().toString(36) + Math.random().toString(36);
  return key;
}

// VC-CRYPTO-002: JWT decode without verify
export function getUserFromToken(token: string) {
  // Vulnerable: decode without verify
  const payload = jwt.decode(token);
  return payload;
}

// VC-CRYPTO-003: Weak hashing
export function hashPassword(password: string) {
  // Vulnerable: MD5 for password
  return crypto.createHash("md5").update(password).digest("hex");
}
