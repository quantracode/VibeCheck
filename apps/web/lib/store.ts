"use client";

import { create } from "zustand";
import type { ScanArtifact, Finding } from "@vibecheck/schema";
import {
  getAllArtifacts,
  saveArtifact,
  deleteArtifact,
  type StoredArtifact,
} from "./db";
export type { StoredArtifact } from "./db";

interface ArtifactStore {
  // State
  artifacts: StoredArtifact[];
  selectedArtifactId: string | null;
  isLoading: boolean;
  error: string | null;

  // Computed
  selectedArtifact: StoredArtifact | null;
  currentFindings: Finding[];

  // Actions
  loadArtifacts: () => Promise<void>;
  importArtifact: (artifact: ScanArtifact, name?: string) => Promise<string>;
  removeArtifact: (id: string) => Promise<void>;
  selectArtifact: (id: string | null) => void;
  clearError: () => void;
}

export const useArtifactStore = create<ArtifactStore>((set, get) => ({
  // Initial state
  artifacts: [],
  selectedArtifactId: null,
  isLoading: false,
  error: null,

  // Computed getters
  get selectedArtifact() {
    const { artifacts, selectedArtifactId } = get();
    return artifacts.find((a) => a.id === selectedArtifactId) ?? null;
  },

  get currentFindings() {
    const selected = get().selectedArtifact;
    return selected?.artifact.findings ?? [];
  },

  // Actions
  loadArtifacts: async () => {
    set({ isLoading: true, error: null });
    try {
      const artifacts = await getAllArtifacts();
      set({
        artifacts,
        isLoading: false,
        // Auto-select the first artifact if none selected
        selectedArtifactId:
          get().selectedArtifactId ?? (artifacts[0]?.id ?? null),
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to load artifacts",
        isLoading: false,
      });
    }
  },

  importArtifact: async (artifact: ScanArtifact, name?: string) => {
    set({ isLoading: true, error: null });
    try {
      const id = await saveArtifact(artifact, name);
      const artifacts = await getAllArtifacts();
      set({
        artifacts,
        selectedArtifactId: id,
        isLoading: false,
      });
      return id;
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to import artifact",
        isLoading: false,
      });
      throw err;
    }
  },

  removeArtifact: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await deleteArtifact(id);
      const artifacts = await getAllArtifacts();
      const { selectedArtifactId } = get();
      set({
        artifacts,
        isLoading: false,
        // If we deleted the selected artifact, select the first remaining one
        selectedArtifactId:
          selectedArtifactId === id
            ? (artifacts[0]?.id ?? null)
            : selectedArtifactId,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to delete artifact",
        isLoading: false,
      });
    }
  },

  selectArtifact: (id: string | null) => {
    set({ selectedArtifactId: id });
  },

  clearError: () => {
    set({ error: null });
  },
}));

// Filter and sort types
export type SeverityFilter = "all" | "critical" | "high" | "medium" | "low" | "info";
export type CategoryFilter = "all" | "auth" | "validation" | "middleware" | "secrets" | "injection" | "privacy" | "config" | "network" | "crypto" | "uploads" | "hallucinations" | "abuse" | "other";

export interface FindingsFilter {
  severity: SeverityFilter;
  category: CategoryFilter;
  search: string;
}

const SEVERITY_ORDER = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

export function filterAndSortFindings(
  findings: Finding[],
  filter: FindingsFilter
): Finding[] {
  let result = [...findings];

  // Filter by severity
  if (filter.severity !== "all") {
    result = result.filter((f) => f.severity === filter.severity);
  }

  // Filter by category
  if (filter.category !== "all") {
    result = result.filter((f) => f.category === filter.category);
  }

  // Filter by search (title, description, ruleId)
  if (filter.search.trim()) {
    const searchLower = filter.search.toLowerCase();
    result = result.filter(
      (f) =>
        f.title.toLowerCase().includes(searchLower) ||
        f.description.toLowerCase().includes(searchLower) ||
        f.ruleId.toLowerCase().includes(searchLower)
    );
  }

  // Sort by severity (desc) then confidence (desc)
  result.sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
    if (sevDiff !== 0) return sevDiff;
    return b.confidence - a.confidence;
  });

  return result;
}
