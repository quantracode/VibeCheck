"use client";

import { motion } from "framer-motion";
import { ArrowRight, Terminal, Shield, Zap, Lock, CheckCircle2 } from "lucide-react";

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Background */}
      <div className="absolute inset-0 gradient-bg" />
      <div className="absolute inset-0 grid-bg" />

      {/* Floating elements */}
      <motion.div
        className="absolute top-1/4 left-[15%] w-64 h-64 rounded-full bg-emerald-500/5 blur-3xl"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3]
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-1/4 right-[15%] w-96 h-96 rounded-full bg-emerald-500/5 blur-3xl"
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.5, 0.3, 0.5]
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative max-w-6xl mx-auto px-6 py-24 lg:py-32">
        <div className="text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-800/50 border border-zinc-700/50 mb-8"
          >
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse-subtle" />
            <span className="text-sm text-zinc-400">Now in public beta</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight"
          >
            <span className="text-zinc-100">Security scanning</span>
            <br />
            <span className="text-gradient">for modern codebases</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-6 text-xl text-zinc-400 max-w-2xl mx-auto"
          >
            Catch security issues before they ship. VibeCheck analyzes your code locally
            and gives you a clear report of what needs attention.
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <a
              href="/docs"
              className="group flex items-center gap-2 px-6 py-3 btn-primary font-medium rounded-lg"
            >
              Get started
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </a>
            <a
              href="#features"
              className="flex items-center gap-2 px-6 py-3 btn-secondary text-zinc-300 font-medium rounded-lg"
            >
              See how it works
            </a>
          </motion.div>

          {/* Terminal preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="mt-16 lg:mt-20"
          >
            <div className="terminal rounded-xl overflow-hidden max-w-3xl mx-auto">
              {/* Terminal header */}
              <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900/50 border-b border-zinc-800/50">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-zinc-700" />
                  <div className="w-3 h-3 rounded-full bg-zinc-700" />
                  <div className="w-3 h-3 rounded-full bg-zinc-700" />
                </div>
                <span className="flex-1 text-center text-xs text-zinc-500 font-mono">terminal</span>
              </div>

              {/* Terminal content */}
              <div className="p-6 font-mono text-sm">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="flex items-center gap-2 text-zinc-400"
                >
                  <span className="text-emerald-500">$</span>
                  <span>npx vibecheck scan ./src</span>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.2 }}
                  className="mt-4 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-500" />
                    <span className="text-zinc-300">Scanning 847 files...</span>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.8 }}
                  className="mt-4 pt-4 border-t border-zinc-800/50 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Critical</span>
                    <span className="text-red-400 font-medium">2 issues</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">High</span>
                    <span className="text-orange-400 font-medium">5 issues</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Medium</span>
                    <span className="text-yellow-400 font-medium">12 issues</span>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 2.4 }}
                  className="mt-4 pt-4 border-t border-zinc-800/50"
                >
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Scan complete in 2.1s</span>
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>

          {/* Trust indicators */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="mt-16 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm text-zinc-500"
          >
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-500/70" />
              <span>100% local analysis</span>
            </div>
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-500/70" />
              <span>Zero config setup</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-500/70" />
              <span>Under 3s scan time</span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
