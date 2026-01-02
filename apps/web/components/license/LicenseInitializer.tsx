"use client";

import { useEffect } from "react";
import { useLicenseStore } from "@/lib/license-store";

/**
 * Initialize license store on app load
 * Place this component near the root of your app
 */
export function LicenseInitializer() {
  const { initialize, initialized } = useLicenseStore();

  useEffect(() => {
    if (!initialized) {
      initialize();
    }
  }, [initialize, initialized]);

  return null;
}
