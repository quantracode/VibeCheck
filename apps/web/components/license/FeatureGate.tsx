"use client";

import { type ReactNode } from "react";
import { useFeatureAccess } from "@/lib/license-store";
import { FEATURES, type FeatureId } from "@/lib/features";
import { UpgradePrompt } from "./UpgradePrompt";

interface FeatureGateProps {
  /** Feature ID to check */
  feature: FeatureId;
  /** Content to render when feature is available */
  children: ReactNode;
  /** Custom fallback when feature is locked (defaults to UpgradePrompt) */
  fallback?: ReactNode;
  /** If true, renders children but disabled/overlayed */
  showPreview?: boolean;
  /** Custom className for the wrapper */
  className?: string;
}

/**
 * Gate content behind a feature flag
 *
 * Usage:
 * ```tsx
 * <FeatureGate feature="baseline">
 *   <BaselineSelector ... />
 * </FeatureGate>
 * ```
 */
export function FeatureGate({
  feature,
  children,
  fallback,
  showPreview = false,
  className,
}: FeatureGateProps) {
  const { hasAccess, isLoading } = useFeatureAccess(feature);

  // Loading state
  if (isLoading) {
    return (
      <div className={className}>
        <div className="animate-pulse bg-zinc-800/50 rounded-lg h-24" />
      </div>
    );
  }

  // Feature available
  if (hasAccess) {
    return <div className={className}>{children}</div>;
  }

  // Feature locked - show preview with overlay
  if (showPreview) {
    return (
      <div className={`relative ${className}`}>
        {/* Blurred/disabled content */}
        <div className="pointer-events-none opacity-40 blur-[1px] select-none">
          {children}
        </div>

        {/* Overlay with upgrade prompt */}
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/60 backdrop-blur-sm rounded-lg">
          <UpgradePrompt
            feature={feature}
            compact
          />
        </div>
      </div>
    );
  }

  // Feature locked - show fallback or upgrade prompt
  return (
    <div className={className}>
      {fallback ?? <UpgradePrompt feature={feature} />}
    </div>
  );
}

/**
 * Inline feature check for conditional rendering
 */
export function useFeatureGate(feature: FeatureId) {
  const { hasAccess, plan, isLoading } = useFeatureAccess(feature);
  const featureInfo = FEATURES[feature];

  return {
    hasAccess,
    isLoading,
    plan,
    featureInfo,
    requiredPlan: featureInfo?.minPlan ?? "pro",
  };
}
