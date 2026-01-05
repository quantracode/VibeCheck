"use client";

import { useState } from "react";
import { usePolicyStore, type Waiver } from "@/lib/policy-store";
import { generateWaiverId } from "@vibecheck/policy";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Shield, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FeatureGate, useFeatureGate } from "@/components/license";

interface AddWaiverFormProps {
  onAdd: (waiver: Waiver) => void;
  onClose: () => void;
  prefilledFingerprint?: string;
  prefilledRuleId?: string;
}

function AddWaiverForm({
  onAdd,
  onClose,
  prefilledFingerprint,
  prefilledRuleId,
}: AddWaiverFormProps) {
  const [matchType, setMatchType] = useState<"fingerprint" | "ruleId">(
    prefilledFingerprint ? "fingerprint" : "ruleId"
  );
  const [fingerprint, setFingerprint] = useState(prefilledFingerprint ?? "");
  const [ruleId, setRuleId] = useState(prefilledRuleId ?? "");
  const [pathPattern, setPathPattern] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!reason.trim()) {
      setError("Reason is required");
      return;
    }

    if (matchType === "fingerprint" && !fingerprint.trim()) {
      setError("Fingerprint is required");
      return;
    }

    if (matchType === "ruleId" && !ruleId.trim()) {
      setError("Rule ID is required");
      return;
    }

    const waiver: Waiver = {
      id: generateWaiverId(),
      match:
        matchType === "fingerprint"
          ? { fingerprint: fingerprint.trim() }
          : {
              ruleId: ruleId.trim(),
              pathPattern: pathPattern.trim() || undefined,
            },
      reason: reason.trim(),
      createdBy: "web-ui",
      createdAt: new Date().toISOString(),
    };

    onAdd(waiver);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Match Type Toggle */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant={matchType === "fingerprint" ? "default" : "outline"}
          size="sm"
          onClick={() => setMatchType("fingerprint")}
        >
          By Fingerprint
        </Button>
        <Button
          type="button"
          variant={matchType === "ruleId" ? "default" : "outline"}
          size="sm"
          onClick={() => setMatchType("ruleId")}
        >
          By Rule ID
        </Button>
      </div>

      {/* Fingerprint Input */}
      {matchType === "fingerprint" && (
        <div>
          <label className="text-sm font-medium">Fingerprint</label>
          <Input
            value={fingerprint}
            onChange={(e) => setFingerprint(e.target.value)}
            placeholder="sha256:..."
            className="mt-1"
          />
        </div>
      )}

      {/* Rule ID Input */}
      {matchType === "ruleId" && (
        <>
          <div>
            <label className="text-sm font-medium">Rule ID</label>
            <Input
              value={ruleId}
              onChange={(e) => setRuleId(e.target.value)}
              placeholder="VC-AUTH-001 or VC-AUTH-*"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Use * for wildcards (e.g., VC-AUTH-*)
            </p>
          </div>
          <div>
            <label className="text-sm font-medium">Path Pattern (optional)</label>
            <Input
              value={pathPattern}
              onChange={(e) => setPathPattern(e.target.value)}
              placeholder="src/legacy/**"
              className="mt-1"
            />
          </div>
        </>
      )}

      {/* Reason */}
      <div>
        <label className="text-sm font-medium">Reason *</label>
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why is this waiver needed?"
          className="mt-1"
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">Add Waiver</Button>
      </div>
    </form>
  );
}

interface WaiverManagerProps {
  className?: string;
  prefilledFingerprint?: string;
  prefilledRuleId?: string;
}

export function WaiverManager({
  className,
  prefilledFingerprint,
  prefilledRuleId,
}: WaiverManagerProps) {
  const { waivers, addWaiver, removeWaiver, clearWaivers } = usePolicyStore();
  const [isAddOpen, setIsAddOpen] = useState(false);

  return (
    <FeatureGate feature="waivers" showPreview className={cn(className)}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Waivers
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/10 text-amber-500 rounded border border-amber-500/20">
                Pro
              </span>
            </CardTitle>
            <div className="flex gap-2">
              {waivers.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearWaivers}>
                  Clear All
                </Button>
              )}
              <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Waiver</DialogTitle>
                  </DialogHeader>
                  <AddWaiverForm
                    onAdd={addWaiver}
                    onClose={() => setIsAddOpen(false)}
                    prefilledFingerprint={prefilledFingerprint}
                    prefilledRuleId={prefilledRuleId}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {waivers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No waivers configured. Add a waiver to suppress specific findings.
            </p>
          ) : (
            <ul className="space-y-2">
              {waivers.map((waiver) => (
                <li
                  key={waiver.id}
                  className="flex items-start justify-between gap-2 p-2 rounded-md bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      {waiver.match.fingerprint ? (
                        <span className="font-mono text-xs truncate">
                          {waiver.match.fingerprint.slice(0, 20)}...
                        </span>
                      ) : (
                        <span className="font-mono text-xs">
                          {waiver.match.ruleId}
                          {waiver.match.pathPattern && (
                            <span className="text-muted-foreground">
                              {" "}
                              @ {waiver.match.pathPattern}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {waiver.reason}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeWaiver(waiver.id)}
                    className="shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </FeatureGate>
  );
}

// Quick waive button for individual findings
interface QuickWaiveButtonProps {
  fingerprint: string;
  ruleId: string;
}

export function QuickWaiveButton({ fingerprint, ruleId }: QuickWaiveButtonProps) {
  const { waivers, addWaiver } = usePolicyStore();
  const [isOpen, setIsOpen] = useState(false);
  const { hasAccess } = useFeatureGate("waivers");

  // Check if already waived
  const isWaived = waivers.some(
    (w) => w.match.fingerprint === fingerprint || w.match.ruleId === ruleId
  );

  if (isWaived) {
    return (
      <span className="text-xs text-green-500 flex items-center gap-1">
        <Shield className="w-3 h-3" />
        Waived
      </span>
    );
  }

  // Don't show waive button if user doesn't have access
  if (!hasAccess) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Shield className="w-3 h-3 mr-1" />
          Waive
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Waiver</DialogTitle>
        </DialogHeader>
        <AddWaiverForm
          onAdd={addWaiver}
          onClose={() => setIsOpen(false)}
          prefilledFingerprint={fingerprint}
          prefilledRuleId={ruleId}
        />
      </DialogContent>
    </Dialog>
  );
}
