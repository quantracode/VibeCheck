import { ZodError } from "zod";
import { ScanArtifactSchema, type ScanArtifact } from "./schemas/index.js";

export class ArtifactValidationError extends Error {
  public readonly issues: ZodError["issues"];

  constructor(zodError: ZodError) {
    const message = zodError.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    super(`Invalid artifact: ${message}`);
    this.name = "ArtifactValidationError";
    this.issues = zodError.issues;
  }
}

/**
 * Validates a JSON object against the ScanArtifact schema.
 * Returns the parsed and typed artifact on success.
 * Throws ArtifactValidationError on validation failure.
 *
 * @param json - The JSON object to validate (typically from JSON.parse)
 * @returns The validated ScanArtifact
 * @throws ArtifactValidationError if validation fails
 */
export function validateArtifact(json: unknown): ScanArtifact {
  const result = ScanArtifactSchema.safeParse(json);

  if (!result.success) {
    throw new ArtifactValidationError(result.error);
  }

  return result.data;
}

/**
 * Safely validates a JSON object against the ScanArtifact schema.
 * Returns a result object instead of throwing.
 *
 * @param json - The JSON object to validate
 * @returns Object with success flag and either data or error
 */
export function safeValidateArtifact(json: unknown):
  | { success: true; data: ScanArtifact }
  | { success: false; error: ArtifactValidationError } {
  const result = ScanArtifactSchema.safeParse(json);

  if (!result.success) {
    return {
      success: false,
      error: new ArtifactValidationError(result.error),
    };
  }

  return { success: true, data: result.data };
}
