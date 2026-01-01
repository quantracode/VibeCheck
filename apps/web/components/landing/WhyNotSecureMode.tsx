"use client";

import { motion } from "framer-motion";
import { Check, X, HelpCircle } from "lucide-react";

const rows = [
  { feature: "Blocks deploys on issues", llm: false, vibecheck: true },
  { feature: "Tracks posture over time", llm: false, vibecheck: true },
  { feature: "Catches regressions", llm: false, vibecheck: true },
  { feature: "Provides evidence", llm: false, vibecheck: true },
  { feature: "Runs in CI/CD", llm: false, vibecheck: true },
  { feature: "Deterministic output", llm: false, vibecheck: true },
];

export function WhyNotSecureMode() {
  return (
    <section className="relative px-6 py-24 lg:py-32">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-800/50 border border-zinc-700/50 mb-6">
            <HelpCircle className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-zinc-400">Why not just use AI?</span>
          </div>

          <h2 className="text-4xl lg:text-5xl font-bold tracking-tight">
            AI suggestions aren't
            <br />
            <span className="text-zinc-500">enforcement</span>
          </h2>

          <p className="mt-4 text-lg text-zinc-400 max-w-xl mx-auto">
            Your AI assistant helps during development. VibeCheck enforces before deploy.
          </p>
        </motion.div>

        {/* Comparison table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="rounded-xl overflow-hidden card-elevated"
        >
          {/* Header row */}
          <div className="grid grid-cols-3 bg-zinc-900/80 border-b border-zinc-800/50">
            <div className="px-6 py-4" />
            <div className="px-6 py-4 text-center border-l border-zinc-800/50">
              <span className="text-sm font-medium text-zinc-500">AI "Secure Mode"</span>
            </div>
            <div className="px-6 py-4 text-center border-l border-zinc-800/50">
              <span className="text-sm font-semibold text-emerald-400">VibeCheck</span>
            </div>
          </div>

          {/* Data rows */}
          {rows.map((row, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: 0.2 + i * 0.05 }}
              className={`grid grid-cols-3 ${
                i !== rows.length - 1 ? "border-b border-zinc-800/30" : ""
              }`}
            >
              <div className="px-6 py-4 text-sm text-zinc-300">{row.feature}</div>
              <div className="px-6 py-4 flex justify-center border-l border-zinc-800/30">
                <div className="w-6 h-6 rounded-full bg-zinc-800/50 flex items-center justify-center">
                  <X className="w-3.5 h-3.5 text-zinc-600" />
                </div>
              </div>
              <div className="px-6 py-4 flex justify-center border-l border-zinc-800/30">
                <motion.div
                  className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center"
                  whileHover={{ scale: 1.1 }}
                >
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                </motion.div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom note */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-8 text-center text-sm text-zinc-500"
        >
          AI suggestions are probabilistic.{" "}
          <span className="text-zinc-300">VibeCheck findings are proof.</span>
        </motion.p>
      </div>
    </section>
  );
}
