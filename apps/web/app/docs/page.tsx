"use client";

import { motion } from "framer-motion";
import {
  Rocket,
  CheckCircle2,
  ArrowRight,
  Terminal as TerminalIcon,
  Zap,
  Shield,
  Clock,
} from "lucide-react";
import { CodeBlock, InstallTabs } from "@/components/docs/CodeBlock";

const benefits = [
  { icon: Zap, text: "Zero configuration required" },
  { icon: Shield, text: "100% local - no data leaves your machine" },
  { icon: Clock, text: "Scans 1000+ files in under 3 seconds" },
];

const platformCommands = [
  {
    label: "npm",
    command: "npx vibecheck scan",
    icon: <TerminalIcon className="w-4 h-4" />,
  },
  {
    label: "pnpm",
    command: "pnpm dlx vibecheck scan",
    icon: <TerminalIcon className="w-4 h-4" />,
  },
  {
    label: "yarn",
    command: "yarn dlx vibecheck scan",
    icon: <TerminalIcon className="w-4 h-4" />,
  },
  {
    label: "bun",
    command: "bunx vibecheck scan",
    icon: <TerminalIcon className="w-4 h-4" />,
  },
];

const globalInstallCommands = [
  {
    label: "npm",
    command: "npm install -g vibecheck",
    icon: <TerminalIcon className="w-4 h-4" />,
  },
  {
    label: "pnpm",
    command: "pnpm add -g vibecheck",
    icon: <TerminalIcon className="w-4 h-4" />,
  },
  {
    label: "yarn",
    command: "yarn global add vibecheck",
    icon: <TerminalIcon className="w-4 h-4" />,
  },
  {
    label: "bun",
    command: "bun add -g vibecheck",
    icon: <TerminalIcon className="w-4 h-4" />,
  },
];

export default function InstallationPage() {
  return (
    <div className="max-w-3xl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Rocket className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-zinc-100">Installation</h1>
            <p className="text-sm text-zinc-500">Get up and running in under a minute</p>
          </div>
        </div>

        {/* Benefits */}
        <div className="mt-6 flex flex-wrap gap-4">
          {benefits.map((benefit, i) => {
            const Icon = benefit.icon;
            return (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800/50 border border-zinc-700/50 text-sm text-zinc-400"
              >
                <Icon className="w-4 h-4 text-emerald-500" />
                {benefit.text}
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Quick Start */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mt-12"
      >
        <h2 className="text-xl font-semibold text-zinc-100 mb-4 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-emerald-500 text-zinc-950 text-sm font-bold flex items-center justify-center">
            1
          </span>
          Quick Start (No Installation)
        </h2>
        <p className="text-zinc-400 mb-4">
          The fastest way to try VibeCheck. Run this command in your project directory:
        </p>
        <InstallTabs commands={platformCommands} />
        <p className="mt-3 text-sm text-zinc-500">
          This will scan your current directory and output a security report.
        </p>
      </motion.section>

      {/* Global Installation */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mt-12"
      >
        <h2 className="text-xl font-semibold text-zinc-100 mb-4 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-emerald-500 text-zinc-950 text-sm font-bold flex items-center justify-center">
            2
          </span>
          Global Installation (Recommended)
        </h2>
        <p className="text-zinc-400 mb-4">
          For regular use, install VibeCheck globally to use it from anywhere:
        </p>
        <InstallTabs commands={globalInstallCommands} />
        <p className="mt-3 text-sm text-zinc-500">
          After installation, you can run <code className="px-1.5 py-0.5 rounded bg-zinc-800 text-emerald-400 text-xs">vibecheck</code> from any directory.
        </p>
      </motion.section>

      {/* Verify Installation */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="mt-12"
      >
        <h2 className="text-xl font-semibold text-zinc-100 mb-4 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-emerald-500 text-zinc-950 text-sm font-bold flex items-center justify-center">
            3
          </span>
          Verify Installation
        </h2>
        <p className="text-zinc-400 mb-4">
          Confirm VibeCheck is installed correctly:
        </p>
        <CodeBlock code="vibecheck --version" title="Terminal" />
        <p className="mt-3 text-sm text-zinc-500">
          You should see the current version number printed to your terminal.
        </p>
      </motion.section>

      {/* Run Your First Scan */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="mt-12"
      >
        <h2 className="text-xl font-semibold text-zinc-100 mb-4 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-emerald-500 text-zinc-950 text-sm font-bold flex items-center justify-center">
            4
          </span>
          Run Your First Scan
        </h2>
        <p className="text-zinc-400 mb-4">
          Navigate to your project directory and run a scan:
        </p>
        <CodeBlock
          code={`# Scan current directory
vibecheck scan

# Scan a specific directory
vibecheck scan ./src

# Output results to a file
vibecheck scan --output report.json`}
          title="Terminal"
          showLineNumbers
        />
      </motion.section>

      {/* Understanding Output */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="mt-12"
      >
        <h2 className="text-xl font-semibold text-zinc-100 mb-4">
          Understanding the Output
        </h2>
        <p className="text-zinc-400 mb-4">
          VibeCheck categorizes findings by severity level:
        </p>
        <div className="space-y-3">
          {[
            { level: "Critical", color: "bg-red-500", desc: "Must fix before deploying. Security vulnerabilities that could be exploited." },
            { level: "High", color: "bg-orange-500", desc: "Should fix soon. Significant security gaps or missing protections." },
            { level: "Medium", color: "bg-yellow-500", desc: "Worth addressing. Potential issues that could become problems." },
            { level: "Low", color: "bg-blue-500", desc: "Nice to fix. Minor improvements to security posture." },
          ].map((item) => (
            <div
              key={item.level}
              className="flex items-start gap-3 p-4 rounded-lg bg-zinc-900/50 border border-zinc-800/50"
            >
              <div className={`w-2 h-2 rounded-full ${item.color} mt-2`} />
              <div>
                <span className="font-medium text-zinc-100">{item.level}</span>
                <p className="text-sm text-zinc-400 mt-1">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Next Steps */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="mt-12 p-6 rounded-xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/5 border border-emerald-500/20"
      >
        <h2 className="text-xl font-semibold text-zinc-100 mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          Next Steps
        </h2>
        <div className="space-y-3">
          {[
            { text: "Configure VibeCheck for your project", href: "/docs/configuration" },
            { text: "Learn about security rules", href: "/docs/rules" },
            { text: "Set up CI/CD integration", href: "/docs/ci-cd" },
          ].map((item) => (
            <a
              key={item.text}
              href={item.href}
              className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700 hover:bg-zinc-800/50 transition-all group"
            >
              <span className="text-zinc-300">{item.text}</span>
              <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
            </a>
          ))}
        </div>
      </motion.section>

      {/* Help */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.7 }}
        className="mt-12 pb-8"
      >
        <p className="text-sm text-zinc-500">
          Need help? Check out the{" "}
          <a href="/docs/quickstart" className="text-emerald-400 hover:underline">
            Quick Start guide
          </a>{" "}
          or{" "}
          <a href="https://github.com" className="text-emerald-400 hover:underline">
            open an issue on GitHub
          </a>
          .
        </p>
      </motion.section>
    </div>
  );
}
