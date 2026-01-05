"use client";

import { useEffect } from "react";
import { useArtifactStore } from "@/lib/store";

export function StoreInitializer() {
  const loadArtifacts = useArtifactStore((s) => s.loadArtifacts);
  const loadFromCLI = useArtifactStore((s) => s.loadFromCLI);

  useEffect(() => {
    const init = async () => {
      // First load any existing artifacts from IndexedDB
      await loadArtifacts();
      // Then try to load from CLI endpoint (if running via `vibecheck view`)
      await loadFromCLI();
    };
    init();
  }, [loadArtifacts, loadFromCLI]);

  return null;
}
