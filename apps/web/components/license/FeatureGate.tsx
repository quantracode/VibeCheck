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
  /** If true, shows a full-page upgrade prompt instead of just an overlay */
  fullPage?: boolean;
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
  fullPage = false,
  className,
}: FeatureGateProps) {
  const { hasAccess, isLoading } = useFeatureAccess(feature);
  const featureInfo = FEATURES[feature];

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
    return <>{children}</>;
  }

  // Feature locked - show full page upgrade prompt
  if (fullPage) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="max-w-md text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-amber-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-2">
              {featureInfo?.name ?? "Pro Feature"}
            </h2>
            <p className="text-muted-foreground">
              {featureInfo?.description ?? "This feature requires a Pro license."}
            </p>
          </div>
          <UpgradePrompt feature={feature} />
        </div>
      </div>
    );
  }

  // Feature locked - show preview with overlay
  if (showPreview) {
    return (
      <div className={`relative ${className ?? ""}`}>
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
