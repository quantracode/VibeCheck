"use client";

import { motion } from "framer-motion";
import { Quote } from "lucide-react";

export function Philosophy() {
  return (
    <section className="relative px-6 py-24 lg:py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 gradient-bg-subtle" />

      <div className="relative max-w-3xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-800/50 border border-zinc-700/50 mb-8">
            <Quote className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-zinc-400">Philosophy</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight">
            Security should be
            <br />
            <span className="text-gradient">opinionated</span>
          </h2>

          <div className="mt-10 space-y-6 text-lg text-zinc-400">
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              We don't ask what severity you want. Missing auth is critical.
              Unused validation is high. We tell you what matters.
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              Regressions fail CI by default. Your security posture only goes forward.
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-zinc-100 font-medium"
            >
              You can override anything. But you have to mean it.
            </motion.p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
