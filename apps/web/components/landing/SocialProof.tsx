"use client";

import { motion } from "framer-motion";

const stats = [
  { value: "847K", label: "Files scanned" },
  { value: "12K", label: "Critical issues caught" },
  { value: "2.1s", label: "Avg scan time" },
  { value: "100%", label: "Runs locally" },
];

const logos = [
  "Acme Corp",
  "Startup.io",
  "DevTools Co",
  "Ship Fast",
  "Build Better",
];

export function SocialProof() {
  return (
    <section className="relative px-6 py-20 border-y border-zinc-800/50">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-zinc-900/50 to-transparent" />

      <div className="relative max-w-6xl mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="text-center"
            >
              <div className="text-4xl lg:text-5xl font-bold text-gradient-emerald">
                {stat.value}
              </div>
              <div className="mt-2 text-sm text-zinc-500">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Logos */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-16 pt-12 border-t border-zinc-800/50"
        >
          <p className="text-center text-xs text-zinc-600 uppercase tracking-widest mb-8">
            Used by developers at
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
            {logos.map((logo, i) => (
              <div
                key={i}
                className="text-xl font-semibold text-zinc-700 hover:text-zinc-500 transition-colors cursor-default"
              >
                {logo}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
