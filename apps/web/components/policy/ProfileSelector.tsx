"use client";

import { motion } from "framer-motion";
import {
  Rocket,
  Shield,
  FileCheck,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProfileName } from "@/lib/policy";

interface ProfileSelectorProps {
  value: ProfileName;
  onChange: (profile: ProfileName) => void;
  className?: string;
}

const PROFILES: Array<{
  name: ProfileName;
  label: string;
  description: string;
  icon: typeof Rocket;
  color: string;
}> = [
  {
    name: "startup",
    label: "Startup",
    description: "Balanced for early-stage. Fails on critical only.",
    icon: Rocket,
    color: "blue",
  },
  {
    name: "strict",
    label: "Strict",
    description: "Production-ready. Fails on high/critical.",
    icon: Shield,
    color: "purple",
  },
  {
    name: "compliance-lite",
    label: "Compliance",
    description: "Security compliance. Strict limits.",
    icon: FileCheck,
    color: "emerald",
  },
];

export function ProfileSelector({ value, onChange, className }: ProfileSelectorProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <label className="text-xs text-zinc-500 uppercase tracking-wide">
        Policy Profile
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {PROFILES.map((profile) => {
          const isSelected = value === profile.name;
          const Icon = profile.icon;
          const colorMap = {
            blue: {
              bg: "bg-blue-500/10",
              border: "border-blue-500/50",
              icon: "text-blue-400",
              ring: "ring-blue-500/30",
            },
            purple: {
              bg: "bg-purple-500/10",
              border: "border-purple-500/50",
              icon: "text-purple-400",
              ring: "ring-purple-500/30",
            },
            emerald: {
              bg: "bg-emerald-500/10",
              border: "border-emerald-500/50",
              icon: "text-emerald-400",
              ring: "ring-emerald-500/30",
            },
          };
          const colorClasses = colorMap[profile.color as keyof typeof colorMap];

          return (
            <motion.button
              key={profile.name}
              onClick={() => onChange(profile.name)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "relative p-4 rounded-xl border-2 text-left transition-all",
                isSelected
                  ? cn(colorClasses.bg, colorClasses.border, "ring-2", colorClasses.ring)
                  : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700"
              )}
            >
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className={cn(
                    "absolute top-2 right-2 p-1 rounded-full",
                    colorClasses.bg
                  )}
                >
                  <Check className={cn("w-3 h-3", colorClasses.icon)} />
                </motion.div>
              )}

              <div className={cn(
                "p-2 rounded-lg w-fit mb-2",
                isSelected ? colorClasses.bg : "bg-zinc-800"
              )}>
                <Icon className={cn(
                  "w-5 h-5",
                  isSelected ? colorClasses.icon : "text-zinc-400"
                )} />
              </div>

              <h4 className={cn(
                "font-medium",
                isSelected ? "text-zinc-100" : "text-zinc-300"
              )}>
                {profile.label}
              </h4>
              <p className="text-xs text-zinc-500 mt-1">
                {profile.description}
              </p>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
