"use client";

import { motion } from "framer-motion";
import { AlertTriangle, ShieldX, FileWarning, Code2 } from "lucide-react";

const problems = [
  {
    icon: ShieldX,
    claim: "Protected by auth middleware",
    reality: "Middleware exists but isn't applied to this route",
  },
  {
    icon: FileWarning,
    claim: "Validates input with Zod",
    reality: "Schema is imported but parse() never called",
  },
  {
    icon: Code2,
    claim: "Sanitized to prevent XSS",
    reality: "Using dangerouslySetInnerHTML without sanitizer",
  },
];

export function Problem() {
  return (
    <section className="relative px-6 py-24 lg:py-32">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 mb-6">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-amber-400">The problem</span>
          </div>

          <h2 className="text-4xl lg:text-5xl font-bold tracking-tight">
            AI code looks secure.
            <br />
            <span className="text-zinc-500">Often it's not.</span>
          </h2>

          <p className="mt-6 text-lg text-zinc-400 max-w-2xl mx-auto">
            Your AI assistant adds comments about security. Imports libraries.
            References middleware. But does it actually connect the dots?
          </p>
        </motion.div>

        {/* Problem cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {problems.map((problem, i) => {
            const Icon = problem.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="group card-elevated rounded-xl p-6"
              >
                {/* Icon */}
                <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4 group-hover:bg-red-500/15 transition-colors">
                  <Icon className="w-5 h-5 text-red-400" />
                </div>

                {/* Claim */}
                <div className="font-mono text-sm text-zinc-300 mb-3">
                  <span className="text-zinc-600">// </span>
                  {problem.claim}
                </div>

                {/* Reality */}
                <div className="flex items-start gap-2 pt-3 border-t border-zinc-800/50">
                  <span className="text-red-400 text-xs mt-0.5">Reality:</span>
                  <span className="text-sm text-zinc-500">{problem.reality}</span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Bottom statement */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-12 text-center text-zinc-400"
        >
          You'd never know until production.{" "}
          <span className="text-zinc-100">Until now.</span>
        </motion.p>
      </div>
    </section>
  );
}
