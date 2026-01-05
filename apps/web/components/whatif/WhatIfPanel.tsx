"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FlaskConical,
  Plus,
  Folder,
  Info,
  Copy,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWhatIfStore } from "@/lib/whatif-store";
import {
  evaluateWithWhatIf,
  convertToWaivers,
  type WhatIfPolicyReport,
} from "@/lib/whatif-evaluator";
import type { ScanArtifact } from "@vibecheck/schema";
import type { ProfileName, Waiver } from "@vibecheck/policy";
import { WhatIfSimulationBanner } from "./WhatIfSimulationBanner";
import { WhatIfChangesCard } from "./WhatIfChangesCard";
import { cn } from "@/lib/utils";

interface WhatIfPanelProps {
  artifact: ScanArtifact;
  baseline?: ScanArtifact | null;
  profile: ProfileName;
  waivers?: Waiver[];
  className?: string;
}

export function WhatIfPanel({
  artifact,
  baseline,
  profile,
  waivers = [],
  className,
}: WhatIfPanelProps) {
  const { isEnabled, overrides, pathIgnores, addPathIgnore } = useWhatIfStore();
  const [showPathForm, setShowPathForm] = useState(false);
  const [pathPattern, setPathPattern] = useState("");
  const [pathReason, setPathReason] = useState("");
  const [pathRuleId, setPathRuleId] = useState("");
  const [copied, setCopied] = useState(false);

  // Compute What-If evaluation
  const whatIfReport = useMemo<WhatIfPolicyReport | null>(() => {
    if (!isEnabled) return null;

    return evaluateWithWhatIf({
      artifact,
      baseline: baseline ?? undefined,
      profile,
      waivers,
      whatIfOverrides: overrides,
      whatIfPathIgnores: pathIgnores,
    });
  }, [artifact, baseline, profile, waivers, overrides, pathIgnores, isEnabled]);

  const handleAddPathIgnore = () => {
    if (!pathPattern.trim() || !pathReason.trim()) return;

    addPathIgnore({
      pathPattern: pathPattern.trim(),
      ruleId: pathRuleId.trim() || undefined,
      reason: pathReason.trim(),
    });

    setPathPattern("");
    setPathReason("");
    setPathRuleId("");
    setShowPathForm(false);
  };

  const handleExportWaivers = () => {
    const exportedWaivers = convertToWaivers(overrides);
    const json = JSON.stringify({ waivers: exportedWaivers }, null, 2);
    navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isEnabled) {
    return null;
  }

  const hasChanges = overrides.length > 0 || pathIgnores.length > 0;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Info card when no changes */}
      {!hasChanges && (
        <Card className="border-dashed border-purple-500/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <FlaskConical className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <h4 className="font-medium">What-If Mode Active</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Click "Simulate" on any finding to test ignoring, downgrading, or waiving it.
                  Changes are not saved - this is just a simulation.
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPathForm(true)}
                    className="gap-1"
                  >
                    <Folder className="w-4 h-4" />
                    Add Path Ignore
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Path ignore form */}
      <AnimatePresence>
        {showPathForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="border-amber-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Folder className="w-4 h-4 text-amber-500" />
                  Add Path Pattern Ignore
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">
                    Path Pattern (glob)
                  </label>
                  <Input
                    placeholder="src/legacy/**/*.ts"
                    value={pathPattern}
                    onChange={(e) => setPathPattern(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">
                    Rule ID (optional, supports * wildcard)
                  </label>
                  <Input
                    placeholder="VC-AUTH-* or leave empty for all rules"
                    value={pathRuleId}
                    onChange={(e) => setPathRuleId(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Reason</label>
                  <Input
                    placeholder="Legacy code - accepted risk"
                    value={pathReason}
                    onChange={(e) => setPathReason(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleAddPathIgnore}
                    disabled={!pathPattern.trim() || !pathReason.trim()}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Pattern
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPathForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Simulation result */}
      {whatIfReport && hasChanges && (
        <>
          <WhatIfSimulationBanner report={whatIfReport} />
          <WhatIfChangesCard changes={whatIfReport.whatIf.changes} />

          {/* Export actions */}
          {overrides.filter((o) => o.action === "waive").length > 0 && (
            <Card className="border-dashed">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Want to make these waivers permanent?
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportWaivers}
                    className="gap-1"
                  >
                    {copied ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy Waivers JSON
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Actions when no changes but mode is active */}
      {!hasChanges && !showPathForm && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Info className="w-4 h-4" />
          Use the "Simulate" dropdown on findings to add overrides
        </div>
      )}
    </div>
  );
}
