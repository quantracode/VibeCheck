"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Shield,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Finding, Severity } from "@vibecheck/schema";

interface SmartWaiverDialogProps {
  finding: Finding;
  onWaive: (reason: string, justification: string) => void;
  trigger?: React.ReactNode;
}

const WAIVER_REASONS = [
  {
    id: "false_positive",
    label: "False Positive",
    description: "The scanner incorrectly flagged this as an issue",
    requiresJustification: true,
    justificationPrompt: "Explain why this is a false positive:",
  },
  {
    id: "accepted_risk",
    label: "Accepted Risk",
    description: "We understand the risk and choose to accept it",
    requiresJustification: true,
    justificationPrompt: "Document the business justification:",
  },
  {
    id: "compensating_control",
    label: "Compensating Control",
    description: "Other security measures mitigate this risk",
    requiresJustification: true,
    justificationPrompt: "Describe the compensating controls:",
  },
  {
    id: "legacy_code",
    label: "Legacy Code",
    description: "This is in legacy code that will be deprecated",
    requiresJustification: true,
    justificationPrompt: "When will this code be deprecated?",
  },
  {
    id: "test_only",
    label: "Test/Dev Only",
    description: "This only affects test or development environments",
    requiresJustification: false,
  },
];

const SEVERITY_WARNINGS: Record<Severity, { message: string; color: string }> = {
  critical: {
    message:
      "This is a CRITICAL severity finding. Waiving this means accepting significant security risk. Ensure you have executive approval.",
    color: "text-red-400 bg-red-500/10 border-red-500/30",
  },
  high: {
    message:
      "This is a HIGH severity finding. Consider whether there are truly no alternatives before waiving.",
    color: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  },
  medium: {
    message:
      "This is a MEDIUM severity finding. Document your reasoning clearly for future reference.",
    color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  },
  low: {
    message: "This is a low severity finding that may still be worth addressing when possible.",
    color: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  },
  info: {
    message: "This is an informational finding. Waiving is acceptable for best-practice recommendations.",
    color: "text-gray-400 bg-gray-500/10 border-gray-500/30",
  },
};

export function SmartWaiverDialog({ finding, onWaive, trigger }: SmartWaiverDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [justification, setJustification] = useState("");
  const [showEducation, setShowEducation] = useState(true);
  const [step, setStep] = useState<"understand" | "reason" | "confirm">("understand");

  const selectedReasonData = WAIVER_REASONS.find((r) => r.id === selectedReason);
  const severityWarning = SEVERITY_WARNINGS[finding.severity];

  const handleSubmit = () => {
    if (selectedReason) {
      onWaive(selectedReason, justification);
      setIsOpen(false);
      resetState();
    }
  };

  const resetState = () => {
    setSelectedReason(null);
    setJustification("");
    setStep("understand");
    setShowEducation(true);
  };

  const canProceed = () => {
    if (step === "understand") return true;
    if (step === "reason") return selectedReason !== null;
    if (step === "confirm") {
      if (selectedReasonData?.requiresJustification) {
        return justification.trim().length >= 20;
      }
      return true;
    }
    return false;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) resetState();
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Shield className="w-4 h-4 mr-2" />
            Waive Finding
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Waive Security Finding
          </DialogTitle>
          <DialogDescription>
            {finding.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Step 1: Understand the Risk */}
          {step === "understand" && (
            <div className="space-y-4">
              {/* Severity Warning */}
              <div className={cn(
                "p-4 rounded-lg border",
                severityWarning.color
              )}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
                  <p className="text-sm">{severityWarning.message}</p>
                </div>
              </div>

              {/* Plain English Impact */}
              {finding.enhancements?.plainEnglish && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">What could happen?</h4>
                  <p className="text-sm text-muted-foreground">
                    {finding.enhancements.plainEnglish.impact}
                  </p>
                  {finding.enhancements.plainEnglish.worstCase && (
                    <p className="text-sm text-red-400/90">
                      Worst case: {finding.enhancements.plainEnglish.worstCase}
                    </p>
                  )}
                </div>
              )}

              {/* Education Toggle */}
              <button
                onClick={() => setShowEducation(!showEducation)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <HelpCircle className="w-4 h-4" />
                What does waiving mean?
                {showEducation ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {showEducation && (
                <div className="text-sm text-muted-foreground space-y-2 p-4 bg-muted/30 rounded-lg">
                  <p>
                    <strong>Waiving</strong> means you acknowledge this security issue but choose
                    not to fix it right now.
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>The finding will still appear in reports, marked as waived</li>
                    <li>Your reason and justification will be recorded</li>
                    <li>You can remove the waiver later if circumstances change</li>
                    <li>Waivers should be reviewed periodically</li>
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Select Reason */}
          {step === "reason" && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Why are you waiving this finding?</h4>
              <div className="space-y-2">
                {WAIVER_REASONS.map((reason) => (
                  <button
                    key={reason.id}
                    onClick={() => setSelectedReason(reason.id)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg border transition-colors",
                      selectedReason === reason.id
                        ? "border-primary bg-primary/10"
                        : "border-muted hover:border-muted-foreground/50"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5",
                        selectedReason === reason.id
                          ? "border-primary bg-primary"
                          : "border-muted-foreground"
                      )}>
                        {selectedReason === reason.id && (
                          <CheckCircle2 className="w-4 h-4 text-primary-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{reason.label}</p>
                        <p className="text-sm text-muted-foreground">{reason.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Confirm with Justification */}
          {step === "confirm" && selectedReasonData && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-sm">
                  <span className="font-medium">Reason:</span> {selectedReasonData.label}
                </p>
              </div>

              {selectedReasonData.requiresJustification && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {selectedReasonData.justificationPrompt}
                  </label>
                  <textarea
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    placeholder="Provide detailed justification (minimum 20 characters)..."
                    className="w-full h-24 px-3 py-2 text-sm rounded-lg border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <p className="text-xs text-muted-foreground">
                    {justification.length}/20 characters minimum
                  </p>
                </div>
              )}

              <div className={cn(
                "p-4 rounded-lg border",
                finding.severity === "critical" || finding.severity === "high"
                  ? "bg-red-500/10 border-red-500/30"
                  : "bg-yellow-500/10 border-yellow-500/30"
              )}>
                <p className="text-sm">
                  By waiving this finding, you confirm that you understand the security
                  implications and accept responsibility for this decision.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-muted-foreground">
              Step {step === "understand" ? 1 : step === "reason" ? 2 : 3} of 3
            </div>
            <div className="flex items-center gap-2">
              {step !== "understand" && (
                <Button
                  variant="ghost"
                  onClick={() => setStep(step === "confirm" ? "reason" : "understand")}
                >
                  Back
                </Button>
              )}
              {step === "confirm" ? (
                <Button
                  onClick={handleSubmit}
                  disabled={!canProceed()}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Confirm Waiver
                </Button>
              ) : (
                <Button
                  onClick={() => setStep(step === "understand" ? "reason" : "confirm")}
                  disabled={!canProceed()}
                >
                  Continue
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
