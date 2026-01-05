"use client";

import { motion } from "framer-motion";
import { FlaskConical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWhatIfStore } from "@/lib/whatif-store";
import { cn } from "@/lib/utils";

interface WhatIfToggleProps {
  className?: string;
}

export function WhatIfToggle({ className }: WhatIfToggleProps) {
  const { isEnabled, toggleMode, getOverrideCount, getPathIgnoreCount, clearAll } = useWhatIfStore();
  const overrideCount = getOverrideCount();
  const pathIgnoreCount = getPathIgnoreCount();
  const totalChanges = overrideCount + pathIgnoreCount;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        variant={isEnabled ? "default" : "outline"}
        size="sm"
        onClick={toggleMode}
        className={cn(
          "gap-2 transition-all",
          isEnabled && "bg-purple-600 hover:bg-purple-700 text-white"
        )}
      >
        <FlaskConical className="w-4 h-4" />
        What-If Mode
        {totalChanges > 0 && (
          <span className="px-1.5 py-0.5 text-xs rounded-full bg-white/20">
            {totalChanges}
          </span>
        )}
      </Button>

      {isEnabled && totalChanges > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="w-4 h-4 mr-1" />
            Clear
          </Button>
        </motion.div>
      )}
    </div>
  );
}
