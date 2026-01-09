"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  title: string;
  icon?: LucideIcon;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
  /** Badge to show next to the title */
  badge?: React.ReactNode;
  /** Whether to show a preview when collapsed */
  preview?: string;
  /** Priority level for default state: high priority sections default open */
  priority?: "high" | "medium" | "low";
}

export function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen,
  children,
  className,
  badge,
  preview,
  priority = "medium",
}: CollapsibleSectionProps) {
  // Default open based on priority if not explicitly set
  const isDefaultOpen = defaultOpen ?? priority === "high";
  const [isOpen, setIsOpen] = useState(isDefaultOpen);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader
        className={cn(
          "cursor-pointer transition-colors hover:bg-accent/30",
          "py-4 px-5",
          !isOpen && "pb-4"
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <CardTitle className="text-base font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="w-5 h-5" />}
            <span>{title}</span>
            {badge}
          </div>
          <div className="flex items-center gap-3">
            {!isOpen && preview && (
              <span className="text-sm text-muted-foreground font-normal truncate max-w-[200px]">
                {preview}
              </span>
            )}
            {isOpen ? (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </CardTitle>
      </CardHeader>
      {isOpen && (
        <CardContent className="pt-0 pb-5 px-5">
          {children}
        </CardContent>
      )}
    </Card>
  );
}

/**
 * Hook to persist section open/closed state
 */
export function useSectionState(sectionId: string, defaultOpen = true) {
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === "undefined") return defaultOpen;
    const stored = localStorage.getItem(`section-state-${sectionId}`);
    return stored !== null ? stored === "true" : defaultOpen;
  });

  const toggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    if (typeof window !== "undefined") {
      localStorage.setItem(`section-state-${sectionId}`, String(newState));
    }
  };

  return { isOpen, toggle, setIsOpen };
}
