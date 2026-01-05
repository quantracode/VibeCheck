"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Key,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Shield,
  Sparkles,
  Calendar,
  User,
  Check,
  ExternalLink,
  WifiOff,
  BarChart3,
  GitCompare,
  Zap,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLicenseStore, useLicenseInfo } from "@/lib/license-store";
import { PLAN_NAMES } from "@/lib/license";

interface LicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FREE_FEATURES = [
  { icon: Shield, text: "All 26 security scanners" },
  { icon: Check, text: "Full vulnerability detection" },
  { icon: Check, text: "Actionable remediation guides" },
  { icon: Check, text: "CLI & CI/CD integration" },
];

const PRO_FEATURES = [
  { icon: BarChart3, text: "Interactive architecture visualization" },
  { icon: GitCompare, text: "Baseline comparison & regression detection" },
  { icon: Sparkles, text: "Security score trends over time" },
  { icon: Zap, text: "Priority support" },
];

export function LicenseModal({ isOpen, onClose }: LicenseModalProps) {
  const [licenseKey, setLicenseKey] = useState("");
  const [mounted, setMounted] = useState(false);

  const {
    activateLicense,
    deactivateLicense,
    isValidating,
    error,
    clearError,
  } = useLicenseStore();

  const { license, plan, isLicensed, expiresAt, daysRemaining } = useLicenseInfo();

  // Track if mounted for portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Clear state when modal opens
  useEffect(() => {
    if (isOpen) {
      setLicenseKey("");
      clearError();
    }
  }, [isOpen, clearError]);

  const handleActivate = async () => {
    const success = await activateLicense(licenseKey.trim());
    if (success) {
      setLicenseKey("");
    }
  };

  const handleDeactivate = () => {
    deactivateLicense();
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Don't render on server
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto"
          >
            <div className="w-full max-w-lg bg-background border border-border rounded-2xl shadow-2xl overflow-hidden my-auto">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20">
                    <Key className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">VibeCheck License</h2>
                    <p className="text-xs text-muted-foreground">
                      {isLicensed ? "Your license is active" : "Unlock Pro features"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {isLicensed && license ? (
                  /* Licensed View */
                  <div className="space-y-5">
                    {/* Active License Card */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
                      <div className="flex items-center gap-3 mb-4">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        <span className="font-medium text-emerald-400">
                          License Active
                        </span>
                        <span className="ml-auto px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-400">
                          {PLAN_NAMES[plan]}
                        </span>
                      </div>

                      <div className="space-y-2.5 text-sm">
                        {license.name && (
                          <div className="flex items-center gap-3 text-muted-foreground">
                            <User className="w-4 h-4" />
                            <span>{license.name}</span>
                          </div>
                        )}
                        {expiresAt && (
                          <div className="flex items-center gap-3 text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            <span>
                              Valid until {expiresAt.toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })}
                              {daysRemaining !== null && daysRemaining <= 30 && (
                                <span className={cn(
                                  "ml-2 text-xs",
                                  daysRemaining <= 7 ? "text-red-400" : "text-yellow-500"
                                )}>
                                  ({daysRemaining} days remaining)
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Renewal Notice */}
                    {daysRemaining !== null && daysRemaining <= 14 && (
                      <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                        <p className="text-sm text-yellow-500 font-medium mb-1">
                          License expiring soon
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Visit the{" "}
                          <a
                            href="https://vibecheckpro.dev"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-400 hover:text-purple-300 underline underline-offset-2"
                          >
                            Pro Portal
                          </a>
                          {" "}to renew your license.
                        </p>
                      </div>
                    )}

                    {/* Local Verification */}
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                      <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Verified locally with cryptographic signatures. No network required.</span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                      <Button
                        variant="outline"
                        onClick={handleDeactivate}
                        className="flex-1"
                      >
                        Deactivate
                      </Button>
                      <Button
                        onClick={onClose}
                        className="flex-1"
                      >
                        Done
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Unlicensed View */
                  <div className="space-y-6">
                    {/* Free vs Pro Comparison */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Free Plan */}
                      <div className="p-4 rounded-xl bg-muted/50 border border-border">
                        <div className="flex items-center gap-2 mb-3">
                          <Shield className="w-4 h-4 text-blue-400" />
                          <span className="font-semibold text-sm">Free</span>
                          <span className="ml-auto px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-500/20 text-blue-400">
                            CURRENT
                          </span>
                        </div>
                        <ul className="space-y-2">
                          {FREE_FEATURES.map((feature, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                              <feature.icon className="w-3.5 h-3.5 mt-0.5 text-emerald-400 flex-shrink-0" />
                              <span>{feature.text}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Pro Plan */}
                      <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/30">
                        <div className="flex items-center gap-2 mb-3">
                          <Sparkles className="w-4 h-4 text-purple-400" />
                          <span className="font-semibold text-sm">Pro</span>
                        </div>
                        <ul className="space-y-2">
                          {PRO_FEATURES.map((feature, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                              <feature.icon className="w-3.5 h-3.5 mt-0.5 text-purple-400 flex-shrink-0" />
                              <span>{feature.text}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* License Input */}
                    <div className="space-y-3">
                      <label className="text-sm font-medium">
                        Have a license key?
                      </label>
                      <Input
                        type="text"
                        placeholder="Paste your license key here..."
                        value={licenseKey}
                        onChange={(e) => setLicenseKey(e.target.value)}
                        className="font-mono text-sm"
                      />

                      {error && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20"
                        >
                          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                          <span className="text-sm text-red-400">{error}</span>
                        </motion.div>
                      )}

                      <Button
                        onClick={handleActivate}
                        disabled={!licenseKey.trim() || isValidating}
                        className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                      >
                        {isValidating ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Validating...
                          </>
                        ) : (
                          <>
                            <Key className="w-4 h-4 mr-2" />
                            Activate License
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Get Pro CTA */}
                    <div className="text-center pt-2">
                      <p className="text-xs text-muted-foreground mb-2">
                        Don't have a license?
                      </p>
                      <a
                        href="https://vibecheckpro.dev"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-purple-400 hover:text-purple-300 transition-colors"
                      >
                        Get VibeCheck Pro
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>

                    {/* Local Verification Note */}
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                      <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Licenses are verified locally. No internet connection required.</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

/**
 * License button for header/navigation
 */
export function LicenseButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { plan, isLicensed } = useLicenseInfo();

  // Listen for custom event to open modal
  useEffect(() => {
    const handleOpen = () => setIsModalOpen(true);
    window.addEventListener("openLicenseModal", handleOpen);
    return () => window.removeEventListener("openLicenseModal", handleOpen);
  }, []);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsModalOpen(true)}
        className={cn(
          "gap-2",
          isLicensed
            ? "text-emerald-400 hover:text-emerald-300"
            : "text-zinc-400 hover:text-zinc-200"
        )}
      >
        {isLicensed ? (
          <>
            <CheckCircle2 className="w-4 h-4" />
            <span className="hidden sm:inline">{PLAN_NAMES[plan]}</span>
          </>
        ) : (
          <>
            <Key className="w-4 h-4" />
            <span className="hidden sm:inline">Free</span>
          </>
        )}
      </Button>

      <LicenseModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
