"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ScanArtifact } from "@vibecheck/schema";
import {
  evaluate,
  PROFILE_NAMES,
  type ProfileName,
  type PolicyReport,
  type Waiver,
} from "@vibecheck/policy";

interface PolicyStore {
  // State
  selectedProfile: ProfileName;
  waivers: Waiver[];
  baselineArtifactId: string | null;
  lastReport: PolicyReport | null;

  // Actions
  setProfile: (profile: ProfileName) => void;
  setBaseline: (artifactId: string | null) => void;
  addWaiver: (waiver: Waiver) => void;
  removeWaiver: (waiverId: string) => void;
  clearWaivers: () => void;
  evaluateArtifact: (
    artifact: ScanArtifact,
    baseline?: ScanArtifact
  ) => PolicyReport;
  clearReport: () => void;
}

export const usePolicyStore = create<PolicyStore>()(
  persist(
    (set, get) => ({
      // Initial state
      selectedProfile: "startup",
      waivers: [],
      baselineArtifactId: null,
      lastReport: null,

      // Actions
      setProfile: (profile: ProfileName) => {
        set({ selectedProfile: profile, lastReport: null });
      },

      setBaseline: (artifactId: string | null) => {
        set({ baselineArtifactId: artifactId, lastReport: null });
      },

      addWaiver: (waiver: Waiver) => {
        const { waivers } = get();
        set({ waivers: [...waivers, waiver], lastReport: null });
      },

      removeWaiver: (waiverId: string) => {
        const { waivers } = get();
        set({
          waivers: waivers.filter((w) => w.id !== waiverId),
          lastReport: null,
        });
      },

      clearWaivers: () => {
        set({ waivers: [], lastReport: null });
      },

      evaluateArtifact: (
        artifact: ScanArtifact,
        baseline?: ScanArtifact
      ): PolicyReport => {
        const { selectedProfile, waivers } = get();
        const report = evaluate({
          artifact,
          baseline,
          profile: selectedProfile,
          waivers,
        });
        set({ lastReport: report });
        return report;
      },

      clearReport: () => {
        set({ lastReport: null });
      },
    }),
    {
      name: "vibecheck-policy",
      partialize: (state) => ({
        selectedProfile: state.selectedProfile,
        waivers: state.waivers,
        baselineArtifactId: state.baselineArtifactId,
      }),
    }
  )
);

export { PROFILE_NAMES };
export type { ProfileName, PolicyReport, Waiver };
