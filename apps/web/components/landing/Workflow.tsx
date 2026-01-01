"use client";

import { motion } from "framer-motion";
import { Terminal, FileJson, Eye, ShieldBan, ArrowRight } from "lucide-react";

const steps = [
  {
    icon: Terminal,
    step: "01",
    title: "Run the scan",
    code: "npx vibecheck scan",
    description: "One command. Works with any project.",
  },
  {
    icon: FileJson,
    step: "02",
    title: "Get the artifact",
    code: "artifact.json",
    description: "Structured output with evidence for every finding.",
  },
  {
    icon: Eye,
    step: "03",
    title: "Review findings",
    code: "vibecheck view",
    description: "Explore issues in a clean UI or your IDE.",
  },
  {
    icon: ShieldBan,
    step: "04",
    title: "Gate deploys",
    code: "exit 1 on critical",
    description: "CI fails if critical issues exist. Simple.",
  },
];

export function Workflow() {
  return (
    <section id="workflow" className="relative px-6 py-24 lg:py-32">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-800/50 border border-zinc-700/50 mb-6">
            <ArrowRight className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-zinc-400">How it works</span>
          </div>

          <h2 className="text-4xl lg:text-5xl font-bold tracking-tight">
            Simple by design
          </h2>
          <p className="mt-4 text-lg text-zinc-400">
            No config files. No dashboards. No account required.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="relative group"
              >
                {/* Connector line */}
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-full w-full h-px">
                    <motion.div
                      initial={{ scaleX: 0 }}
                      whileInView={{ scaleX: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
                      className="h-full bg-gradient-to-r from-zinc-700 to-transparent origin-left"
                    />
                  </div>
                )}

                <div className="card-elevated rounded-xl p-6 h-full">
                  {/* Step number */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-mono text-zinc-600">{step.step}</span>
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500/15 transition-colors">
                      <Icon className="w-5 h-5 text-emerald-400" />
                    </div>
                  </div>

                  {/* Content */}
                  <h3 className="text-lg font-semibold text-zinc-100 mb-2">
                    {step.title}
                  </h3>

                  <code className="inline-block text-xs font-mono text-emerald-400/80 bg-emerald-500/10 px-2 py-1 rounded mb-3">
                    {step.code}
                  </code>

                  <p className="text-sm text-zinc-400">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Bottom tagline */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-16 text-center"
        >
          <p className="text-lg text-zinc-400">
            We don't help you code.{" "}
            <span className="text-zinc-100">We tell you when it's safe to ship.</span>
          </p>
        </motion.div>
      </div>
    </section>
  );
}
