import { z } from "zod";

export const ClaimTypeSchema = z.enum([
  "AUTH_ENFORCED",
  "INPUT_VALIDATED",
  "CSRF_ENABLED",
  "RATE_LIMITED",
  "ENCRYPTED_AT_REST",
  "OTHER",
]);

export const ClaimSourceSchema = z.enum([
  "comment",
  "identifier",
  "import",
  "doc",
  "ui",
  "config",
]);

export const ClaimScopeSchema = z.enum(["route", "module", "global"]);

export const ClaimStrengthSchema = z.enum(["weak", "medium", "strong"]);

export const ClaimLocationSchema = z.object({
  file: z.string(),
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
});

export const ClaimSchema = z.object({
  type: ClaimTypeSchema,
  source: ClaimSourceSchema,
  textEvidence: z.string(),
  location: ClaimLocationSchema,
  scope: ClaimScopeSchema,
  strength: ClaimStrengthSchema,
});

export type ClaimType = z.infer<typeof ClaimTypeSchema>;
export type ClaimSource = z.infer<typeof ClaimSourceSchema>;
export type ClaimScope = z.infer<typeof ClaimScopeSchema>;
export type ClaimStrength = z.infer<typeof ClaimStrengthSchema>;
export type ClaimLocation = z.infer<typeof ClaimLocationSchema>;
export type Claim = z.infer<typeof ClaimSchema>;
