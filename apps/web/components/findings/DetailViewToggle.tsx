"use client";

import { useState, createContext, useContext } from "react";
import { Eye, Code, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type ViewMode = "simple" | "technical" | "full";

interface ViewModeContextType {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}

const ViewModeContext = createContext<ViewModeContextType | null>(null);

export function useViewMode() {
  const context = useContext(ViewModeContext);
  if (!context) {
    return { viewMode: "full" as ViewMode, setViewMode: () => {} };
  }
  return context;
}

interface ViewModeProviderProps {
  children: React.ReactNode;
  defaultMode?: ViewMode;
}

export function ViewModeProvider({ children, defaultMode = "full" }: ViewModeProviderProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return defaultMode;
    const stored = localStorage.getItem("finding-view-mode");
    return (stored as ViewMode) || defaultMode;
  });

  const handleSetViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("finding-view-mode", mode);
    }
  };

  return (
    <ViewModeContext.Provider value={{ viewMode, setViewMode: handleSetViewMode }}>
      {children}
    </ViewModeContext.Provider>
  );
}

interface DetailViewToggleProps {
  className?: string;
}

export function DetailViewToggle({ className }: DetailViewToggleProps) {
  const { viewMode, setViewMode } = useViewMode();

  const options: { value: ViewMode; label: string; icon: typeof Eye; description: string }[] = [
    {
      value: "simple",
      label: "Simple",
      icon: Sparkles,
      description: "Plain English explanations",
    },
    {
      value: "technical",
      label: "Technical",
      icon: Code,
      description: "Full technical details",
    },
    {
      value: "full",
      label: "Full",
      icon: Eye,
      description: "Everything",
    },
  ];

  return (
    <div className={cn("inline-flex items-center p-1 rounded-lg bg-muted/50 border", className)}>
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = viewMode === option.value;
        return (
          <button
            key={option.value}
            onClick={() => setViewMode(option.value)}
            title={option.description}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Wrapper that shows/hides content based on view mode
 */
interface ViewModeContentProps {
  children: React.ReactNode;
  /** Show in these view modes */
  modes: ViewMode[];
}

export function ViewModeContent({ children, modes }: ViewModeContentProps) {
  const { viewMode } = useViewMode();

  if (!modes.includes(viewMode)) {
    return null;
  }

  return <>{children}</>;
}
