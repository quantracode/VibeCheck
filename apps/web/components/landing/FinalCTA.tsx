"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Terminal, Copy, Check, Github } from "lucide-react";

export function FinalCTA() {
  const [copied, setCopied] = useState(false);
  const command = "npx vibecheck scan";

  const handleCopy = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="get-started" className="relative px-6 py-24 lg:py-32">
      <div className="absolute inset-0 gradient-bg" />

      <div className="relative max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
            Start scanning
            <br />
            <span className="text-gradient">in seconds</span>
          </h2>

          <p className="mt-6 text-xl text-zinc-400 max-w-xl mx-auto">
            One command. Zero configuration. See what needs fixing before you ship.
          </p>

          {/* Install command */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-10 inline-flex items-center gap-3 px-5 py-3 rounded-lg bg-zinc-900 border border-zinc-800"
          >
            <Terminal className="w-5 h-5 text-emerald-500" />
            <code className="text-lg font-mono text-zinc-100">{command}</code>
            <button
              onClick={handleCopy}
              className="p-1.5 rounded hover:bg-zinc-800 transition-colors text-zinc-500 hover:text-zinc-300"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </motion.div>

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <a
              href="/docs"
              className="group flex items-center gap-2 px-6 py-3 btn-primary font-medium rounded-lg"
            >
              Read the docs
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </a>
            <a
              href="https://github.com"
              className="flex items-center gap-2 px-6 py-3 btn-secondary text-zinc-300 font-medium rounded-lg"
            >
              <Github className="w-4 h-4" />
              View on GitHub
            </a>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
