import { z } from "zod";

/**
 * Waiver match criteria - can match by fingerprint OR by ruleId + path pattern
 */
export const WaiverMatchSchema = z.object({
  /** Exact fingerprint match */
  fingerprint: z.string().optional(),
  /** Rule ID (exact or prefix like "VC-AUTH-*") */
  ruleId: z.string().optional(),
  /** Path glob pattern for evidence file matching */
  pathPattern: z.string().optional(),
});

/**
 * Individual waiver entry
 */
export const WaiverSchema = z.object({
  /** Unique waiver ID */
  id: z.string(),
  /** Match criteria */
  match: WaiverMatchSchema.refine(
    (m) => m.fingerprint || m.ruleId,
    { message: "Waiver must specify fingerprint or ruleId" }
  ),
  /** Justification for the waiver */
  reason: z.string().min(1),
  /** Who created this waiver */
  createdBy: z.string().min(1),
  /** When the waiver was created */
  createdAt: z.string().datetime(),
  /** Optional expiration date */
  expiresAt: z.string().datetime().optional(),
  /** Optional ticket/issue reference */
  ticketRef: z.string().optional(),
});

/**
 * Waivers file format
 */
export const WaiversFileSchema = z.object({
  /** Schema version */
  version: z.literal("0.1"),
  /** List of waivers */
  waivers: z.array(WaiverSchema),
});

export type WaiverMatch = z.infer<typeof WaiverMatchSchema>;
export type Waiver = z.infer<typeof WaiverSchema>;
export type WaiversFile = z.infer<typeof WaiversFileSchema>;
