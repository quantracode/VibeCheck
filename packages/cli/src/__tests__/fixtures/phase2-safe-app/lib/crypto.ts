import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

// Safe: Using crypto.randomBytes for tokens
export function generateToken() {
  const token = crypto.randomBytes(32).toString("hex");
  return token;
}

export function generateSessionKey() {
  const key = crypto.randomUUID();
  return key;
}

// Safe: JWT verify before trusting payload
export function getUserFromToken(token: string, secret: string) {
  try {
    const payload = jwt.verify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

// Safe: Using bcrypt with proper salt rounds
export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}
