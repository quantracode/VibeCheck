"use client";

import { useEffect } from "react";
import { useArtifactStore } from "@/lib/store";

export function StoreInitializer() {
  const { loadArtifacts } = useArtifactStore();

  useEffect(() => {
    loadArtifacts();
  }, [loadArtifacts]);

  return null;
}
