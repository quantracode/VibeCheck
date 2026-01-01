"use client";

import { motion } from "framer-motion";

interface GridBackgroundProps {
  variant?: "grid" | "dots";
  className?: string;
}

export function GridBackground({ variant = "grid", className = "" }: GridBackgroundProps) {
  return (
    <div className={`absolute inset-0 -z-10 overflow-hidden ${className}`}>
      {/* Base pattern */}
      <div
        className={`absolute inset-0 ${
          variant === "grid" ? "grid-pattern" : "dot-pattern"
        }`}
      />

      {/* Gradient fade at edges */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-transparent to-zinc-950" />
      <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-transparent to-zinc-950 opacity-50" />

      {/* Subtle glow accent */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5 }}
        className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl"
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5, delay: 0.3 }}
        className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-emerald-500/3 rounded-full blur-3xl"
      />
    </div>
  );
}
