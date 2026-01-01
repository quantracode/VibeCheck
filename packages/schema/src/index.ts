// Re-export all schemas and types
export * from "./schemas/index.js";

// Re-export validation utilities
export {
  validateArtifact,
  safeValidateArtifact,
  ArtifactValidationError,
} from "./validate.js";

// Legacy types for backward compatibility
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export interface VibeCheck {
  id: string;
  userId: string;
  score: number;
  mood: "great" | "good" | "okay" | "bad" | "terrible";
  notes?: string;
  createdAt: Date;
}

export type CreateVibeCheckInput = Omit<VibeCheck, "id" | "createdAt">;

export function validateVibeScore(score: number): boolean {
  return score >= 0 && score <= 100;
}

export function getMoodFromScore(score: number): VibeCheck["mood"] {
  if (score >= 80) return "great";
  if (score >= 60) return "good";
  if (score >= 40) return "okay";
  if (score >= 20) return "bad";
  return "terrible";
}
