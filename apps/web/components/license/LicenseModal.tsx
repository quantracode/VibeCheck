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
  Mail,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLicenseStore, useLicenseInfo } from "@/lib/license-store";
import { PLAN_NAMES, generateDemoLicenseKey } from "@/lib/license";
import { Card, CardContent } from "@/components/ui/card";

interface LicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LicenseModal({ isOpen, onClose }: LicenseModalProps) {
  const [licenseKey, setLicenseKey] = useState("");
  const [copied, setCopied] = useState(false);
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

  const handleGenerateDemo = () => {
    const demoKey = generateDemoLicenseKey("pro");
    setLicenseKey(demoKey);
  };

  const handleCopyDemoKey = async () => {
    const demoKey = generateDemoLicenseKey("pro");
    await navigator.clipboard.writeText(demoKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
                    <h2 className="text-lg font-semibold">License</h2>
                    <p className="text-xs text-muted-foreground">
                      {isLicensed ? "Manage your license" : "Activate your license"}
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
                  <div className="space-y-4">
                    {/* License Info Card */}
                    <Card className="border-emerald-500/30 bg-emerald-500/5">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3 mb-4">
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          <span className="font-medium text-emerald-400">
                            License Active
                          </span>
                          <span className="ml-auto px-2 py-1 text-xs font-medium rounded-full bg-emerald-500/20 text-emerald-400">
                            {PLAN_NAMES[plan]}
                          </span>
                        </div>

                        <div className="space-y-3 text-sm">
                          <div className="flex items-center gap-3 text-muted-foreground">
                            <User className="w-4 h-4" />
                            <span>{license.name}</span>
                          </div>
                          <div className="flex items-center gap-3 text-muted-foreground">
                            <Mail className="w-4 h-4" />
                            <span>{license.email}</span>
                          </div>
                          {expiresAt && (
                            <div className="flex items-center gap-3 text-muted-foreground">
                              <Calendar className="w-4 h-4" />
                              <span>
                                Expires {expiresAt.toLocaleDateString()}
                                {daysRemaining !== null && (
                                  <span className={cn(
                                    "ml-2",
                                    daysRemaining <= 7 ? "text-yellow-500" : "text-muted-foreground"
                                  )}>
                                    ({daysRemaining} days remaining)
                                  </span>
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Actions */}
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        onClick={handleDeactivate}
                        className="flex-1"
                      >
                        Deactivate License
                      </Button>
                      <Button
                        variant="outline"
                        onClick={onClose}
                        className="flex-1"
                      >
                        Close
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Unlicensed View */
                  <div className="space-y-6">
                    {/* Current Plan Badge */}
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                      <Shield className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">
                          Current Plan: Free
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Basic features available
                        </p>
                      </div>
                    </div>

                    {/* License Input */}
                    <div className="space-y-3">
                      <label className="text-sm font-medium">
                        Enter License Key
                      </label>
                      <Input
                        type="text"
                        placeholder="XXXX-XXXX-XXXX-XXXX..."
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
                          <AlertCircle className="w-4 h-4 text-red-400" />
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

                    {/* Demo Key */}
                    <div className="pt-4 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-3">
                        For testing, generate a demo license:
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleGenerateDemo}
                          className="flex-1"
                        >
                          <Sparkles className="w-3 h-3 mr-2" />
                          Generate Demo Key
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCopyDemoKey}
                        >
                          {copied ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Get License CTA */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20">
                      <h4 className="font-medium mb-1">
                        Need a license?
                      </h4>
                      <p className="text-xs text-muted-foreground mb-3">
                        Get Pro features for professional security scanning
                      </p>
                      <a
                        href="https://vibecheck.dev/pricing"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-purple-500 hover:text-purple-400 transition-colors"
                      >
                        View pricing →
                      </a>
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
