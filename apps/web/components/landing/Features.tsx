"use client";

import { motion } from "framer-motion";
import {
  Scan,
  ShieldCheck,
  FileCode,
  Lock,
  Zap,
  GitBranch,
  Sparkles
} from "lucide-react";

const features = [
  {
    icon: Scan,
    title: "Catches what AI misses",
    description: "Detects security measures that are mentioned but not implemented.",
    color: "emerald",
  },
  {
    icon: ShieldCheck,
    title: "Blocks bad deploys",
    description: "Critical findings fail CI. No exceptions, no excuses.",
    color: "blue",
  },
  {
    icon: FileCode,
    title: "Shows the receipts",
    description: "Every finding links to the exact line where enforcement is missing.",
    color: "purple",
  },
  {
    icon: Lock,
    title: "Stays on your machine",
    description: "Zero cloud. Zero data collection. Just you and your code.",
    color: "amber",
  },
  {
    icon: Zap,
    title: "Fast enough to not care",
    description: "Scans 1000+ files in under 3 seconds. No coffee break needed.",
    color: "rose",
  },
  {
    icon: GitBranch,
    title: "Tracks your posture",
    description: "Monitors security over time. Blocks regressions automatically.",
    color: "cyan",
  },
];

const colorMap: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  emerald: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    text: "text-emerald-400",
    glow: "group-hover:shadow-emerald-500/20",
  },
  blue: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    text: "text-blue-400",
    glow: "group-hover:shadow-blue-500/20",
  },
  purple: {
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    text: "text-purple-400",
    glow: "group-hover:shadow-purple-500/20",
  },
  amber: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    text: "text-amber-400",
    glow: "group-hover:shadow-amber-500/20",
  },
  rose: {
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
    text: "text-rose-400",
    glow: "group-hover:shadow-rose-500/20",
  },
  cyan: {
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
    text: "text-cyan-400",
    glow: "group-hover:shadow-cyan-500/20",
  },
};

export function Features() {
  return (
    <section id="features" className="relative px-6 py-24 lg:py-32">
      <div className="absolute inset-0 gradient-bg-subtle" />

      <div className="relative max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-800/50 border border-zinc-700/50 mb-6">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-zinc-400">Features</span>
          </div>

          <h2 className="text-4xl lg:text-5xl font-bold tracking-tight">
            Everything you need to
            <br />
            <span className="text-gradient">ship securely</span>
          </h2>

          <p className="mt-6 text-lg text-zinc-400 max-w-xl mx-auto">
            Integrate in seconds. See results instantly. Ship confidently.
          </p>
        </motion.div>

        {/* Feature grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => {
            const colors = colorMap[feature.color];
            const Icon = feature.icon;

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                whileHover={{ y: -4 }}
                className={`group relative p-6 rounded-xl card-elevated ${colors.glow} group-hover:shadow-lg transition-all duration-300`}
              >
                {/* Icon */}
                <motion.div
                  className={`w-12 h-12 rounded-xl ${colors.bg} ${colors.border} border flex items-center justify-center mb-5`}
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                >
                  <Icon className={`w-6 h-6 ${colors.text}`} />
                </motion.div>

                {/* Content */}
                <h3 className="text-lg font-semibold text-zinc-100 mb-2">
                  {feature.title}
                </h3>

                <p className="text-sm text-zinc-400 leading-relaxed">
                  {feature.description}
                </p>

                {/* Hover arrow */}
                <motion.div
                  className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  initial={{ x: -5 }}
                  whileHover={{ x: 0 }}
                >
                  <span className="text-zinc-600">→</span>
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
