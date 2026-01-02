"use client";

import { motion } from "framer-motion";
import { Lock, Sparkles, ArrowRight, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FEATURES, type FeatureId } from "@/lib/features";
import { PLAN_NAMES } from "@/lib/license";

interface UpgradePromptProps {
  /** Feature that requires upgrade */
  feature: FeatureId;
  /** Compact mode for overlay displays */
  compact?: boolean;
  /** Custom title override */
  title?: string;
  /** Custom description override */
  description?: string;
  /** Callback when upgrade is clicked */
  onUpgradeClick?: () => void;
  /** Additional className */
  className?: string;
}

export function UpgradePrompt({
  feature,
  compact = false,
  title,
  description,
  onUpgradeClick,
  className,
}: UpgradePromptProps) {
  const featureInfo = FEATURES[feature];
  const requiredPlan = featureInfo?.minPlan ?? "pro";
  const planName = PLAN_NAMES[requiredPlan];

  const handleUpgradeClick = () => {
    if (onUpgradeClick) {
      onUpgradeClick();
    } else {
      // Open license modal or pricing page
      window.dispatchEvent(new CustomEvent("openLicenseModal"));
    }
  };

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          "flex flex-col items-center gap-3 p-6 text-center",
          className
        )}
      >
        <div className="p-3 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30">
          <Lock className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <p className="font-medium text-zinc-200">
            {title ?? featureInfo?.name ?? "Pro Feature"}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            Requires {planName} plan
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleUpgradeClick}
          className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white"
        >
          <Zap className="w-3 h-3 mr-1" />
          Upgrade
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-blue-500/5 p-6",
        className
      )}
    >
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30">
          <Lock className="w-6 h-6 text-purple-400" />
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-zinc-100">
              {title ?? featureInfo?.name ?? "Pro Feature"}
            </h4>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
              {planName}
            </span>
          </div>

          <p className="text-sm text-zinc-400 mb-4">
            {description ?? featureInfo?.description ?? "Upgrade to unlock this feature"}
          </p>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleUpgradeClick}
              className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Upgrade to {planName}
            </Button>

            <a
              href="/docs/pricing"
              className="text-sm text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
            >
              Learn more
              <ArrowRight className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Feature highlights */}
      {requiredPlan === "pro" && (
        <div className="mt-6 pt-4 border-t border-zinc-800">
          <p className="text-xs text-zinc-500 mb-3">Pro plan includes:</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              "Baseline comparison",
              "Policy customization",
              "Regression detection",
              "Coverage tracking",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 text-zinc-400">
                <div className="w-1 h-1 rounded-full bg-purple-500" />
                {item}
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

/**
 * Small inline badge for locked features
 */
export function ProBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-500/20 text-purple-400 border border-purple-500/30",
        className
      )}
    >
      <Lock className="w-2.5 h-2.5" />
      PRO
    </span>
  );
}
