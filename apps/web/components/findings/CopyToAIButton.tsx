"use client";

import { useState } from "react";
import { Bot, Copy, Check, ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AIPrompt } from "@vibecheck/schema";

interface CopyToAIButtonProps {
  aiPrompt: AIPrompt;
}

export function CopyToAIButton({ aiPrompt }: CopyToAIButtonProps) {
  const [copied, setCopied] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [copiedFollowUp, setCopiedFollowUp] = useState<number | null>(null);

  const handleCopyPrompt = async () => {
    await navigator.clipboard.writeText(aiPrompt.template);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyFollowUp = async (question: string, index: number) => {
    await navigator.clipboard.writeText(question);
    setCopiedFollowUp(index);
    setTimeout(() => setCopiedFollowUp(null), 2000);
  };

  return (
    <Card className="border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2 text-purple-400">
          <Bot className="w-5 h-5" />
          Get AI Help
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Copy this prompt to use with your AI assistant (Claude, ChatGPT, Cursor, etc.)
        </p>

        {/* Main copy button */}
        <Button
          onClick={handleCopyPrompt}
          className={cn(
            "w-full",
            copied
              ? "bg-emerald-500 hover:bg-emerald-600"
              : "bg-purple-500 hover:bg-purple-600"
          )}
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              Copied to Clipboard!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 mr-2" />
              Copy Prompt to AI
            </>
          )}
        </Button>

        {/* Show/hide prompt preview */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowPrompt(!showPrompt)}
          className="text-muted-foreground hover:text-foreground w-full justify-center"
        >
          {showPrompt ? "Hide" : "Preview"} Prompt
          {showPrompt ? (
            <ChevronUp className="w-4 h-4 ml-2" />
          ) : (
            <ChevronDown className="w-4 h-4 ml-2" />
          )}
        </Button>

        {showPrompt && (
          <pre className="text-xs bg-muted/50 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap max-h-64">
            <code className="text-muted-foreground">{aiPrompt.template}</code>
          </pre>
        )}

        {/* Follow-up questions */}
        {aiPrompt.followUpQuestions && aiPrompt.followUpQuestions.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-muted">
            <p className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Suggested Follow-up Questions
            </p>
            <div className="space-y-2">
              {aiPrompt.followUpQuestions.map((question, index) => (
                <button
                  key={index}
                  onClick={() => handleCopyFollowUp(question, index)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg border transition-colors",
                    "text-sm text-muted-foreground hover:text-foreground",
                    "bg-muted/30 hover:bg-muted/50 border-muted",
                    "flex items-center justify-between gap-2"
                  )}
                >
                  <span>&quot;{question}&quot;</span>
                  {copiedFollowUp === index ? (
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <Copy className="w-4 h-4 shrink-0 opacity-50" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
