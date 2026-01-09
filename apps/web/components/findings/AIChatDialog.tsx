"use client";

import { useState, useRef, useEffect } from "react";
import {
  Bot,
  Send,
  User,
  Copy,
  Check,
  Sparkles,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Finding } from "@vibecheck/schema";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AIChatDialogProps {
  finding: Finding;
  trigger?: React.ReactNode;
}

// Simulated AI responses based on question patterns
function generateResponse(question: string, finding: Finding): string {
  const lowerQ = question.toLowerCase();

  if (lowerQ.includes("why") && (lowerQ.includes("dangerous") || lowerQ.includes("bad") || lowerQ.includes("problem"))) {
    return `This ${finding.severity} severity issue (${finding.ruleId}) is concerning because:

${finding.enhancements?.plainEnglish?.impact || finding.description}

${finding.enhancements?.plainEnglish?.worstCase ? `**Worst case scenario:** ${finding.enhancements.plainEnglish.worstCase}` : ""}

The underlying issue is in the ${finding.category} category, which means it relates to ${getCategoryExplanation(finding.category)}.`;
  }

  if (lowerQ.includes("fix") || lowerQ.includes("solve") || lowerQ.includes("remediate")) {
    const steps = finding.enhancements?.fixSteps;
    if (steps && steps.length > 0) {
      return `Here's how to fix this issue:

${steps.map((step) => `**Step ${step.step}: ${step.title}**
${step.action}
${step.code ? `\n\`\`\`\n${step.code}\n\`\`\`` : ""}
${step.verification ? `\n*Verify:* ${step.verification}` : ""}`).join("\n\n")}`;
    }
    return `To fix this issue:\n\n${finding.remediation.recommendedFix}\n\n${finding.remediation.patch ? `Here's a suggested patch:\n\`\`\`\n${finding.remediation.patch}\n\`\`\`` : ""}`;
  }

  if (lowerQ.includes("test") || lowerQ.includes("verify") || lowerQ.includes("check")) {
    return `To verify this issue is fixed, you can:

1. **Manual testing:** Try to reproduce the vulnerability described in the finding
2. **Code review:** Ensure the fix properly addresses the root cause
3. **Re-run the scanner:** Run \`vibecheck scan\` again to confirm the finding is resolved

For ${finding.category} issues specifically, you should ${getTestAdvice(finding.category)}.`;
  }

  if (lowerQ.includes("similar") || lowerQ.includes("other") || lowerQ.includes("more")) {
    return `To find similar issues in your codebase:

1. Run a targeted scan: \`vibecheck scan --rules ${finding.category}\`
2. Look for other findings with rule ID pattern \`${finding.ruleId.split("-").slice(0, 2).join("-")}*\`
3. Search for similar patterns in your code: ${getSearchPattern(finding.category)}

Consider setting up a pre-commit hook to catch these issues early.`;
  }

  // Default helpful response
  return `I can help you understand this ${finding.severity} severity finding.

**The Issue:** ${finding.enhancements?.plainEnglish?.problem || finding.title}

**Category:** ${finding.category} - ${getCategoryExplanation(finding.category)}

**Quick Actions:**
- Ask me "How do I fix this?"
- Ask me "Why is this dangerous?"
- Ask me "How can I test if it's fixed?"

Or copy the full prompt to use with your preferred AI assistant.`;
}

function getCategoryExplanation(category: string): string {
  const explanations: Record<string, string> = {
    auth: "authentication and access control",
    validation: "input validation and sanitization",
    middleware: "middleware configuration and coverage",
    secrets: "credential and secret management",
    injection: "code or command injection vulnerabilities",
    privacy: "data privacy and information disclosure",
    config: "security configuration settings",
    network: "network security and request handling",
    crypto: "cryptographic implementations",
    uploads: "file upload handling",
    hallucinations: "security assumptions vs reality",
    abuse: "compute resource abuse prevention",
    authorization: "permission and role enforcement",
    lifecycle: "CRUD operation security consistency",
    "supply-chain": "dependency and package security",
  };
  return explanations[category] || "security best practices";
}

function getTestAdvice(category: string): string {
  const advice: Record<string, string> = {
    auth: "try accessing the endpoint without authentication and verify you receive a 401 response",
    validation: "send malformed or malicious input and verify it's properly rejected",
    network: "check that CORS headers and timeouts are properly configured",
    crypto: "verify that secure algorithms are being used and random values are cryptographically random",
  };
  return advice[category] || "thoroughly test the security boundaries";
}

function getSearchPattern(category: string): string {
  const patterns: Record<string, string> = {
    auth: "`getServerSession`, `auth()`, `requireAuth`",
    validation: "`z.parse`, `validate`, `sanitize`",
    network: "`fetch`, `axios`, `cors`",
    crypto: "`bcrypt`, `jwt`, `crypto`",
  };
  return patterns[category] || "security-related function calls";
}

export function AIChatDialog({ finding, trigger }: AIChatDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    // Simulate AI response delay
    setTimeout(() => {
      const response = generateResponse(input, finding);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 800);
  };

  const handleCopyPrompt = async () => {
    const prompt = finding.enhancements?.aiPrompt?.template ||
      `Help me fix this security issue:\n\n${finding.title}\n\n${finding.description}`;
    await navigator.clipboard.writeText(prompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const suggestedQuestions = [
    "Why is this dangerous?",
    "How do I fix this?",
    "How can I test if it's fixed?",
    "Are there similar issues?",
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Bot className="w-4 h-4 mr-2" />
            Ask AI
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            AI Security Assistant
          </DialogTitle>
          <DialogDescription>
            Ask questions about {finding.ruleId}: {finding.title}
          </DialogDescription>
        </DialogHeader>

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {messages.length === 0 ? (
            <div className="text-center space-y-4 py-8">
              <Bot className="w-12 h-12 mx-auto text-muted-foreground" />
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Ask me anything about this security finding
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {suggestedQuestions.map((q) => (
                    <Button
                      key={q}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setInput(q);
                        setTimeout(() => handleSend(), 0);
                      }}
                      className="text-xs"
                    >
                      {q}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-purple-400" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg p-3",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                </div>
                {message.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))
          )}
          {isTyping && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-purple-400" />
              </div>
              <div className="bg-muted rounded-lg p-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t pt-4 space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask about this security finding..."
              className="flex-1 px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button onClick={handleSend} disabled={!input.trim() || isTyping}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              This is a local simulation. For full AI assistance:
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyPrompt}
              className="text-xs"
            >
              {copiedPrompt ? (
                <>
                  <Check className="w-3 h-3 mr-1 text-emerald-400" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 mr-1" />
                  Copy prompt for Claude/ChatGPT
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
