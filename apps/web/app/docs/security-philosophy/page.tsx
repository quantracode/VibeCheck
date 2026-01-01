"use client";

import { motion } from "framer-motion";
import { Scale, ShieldCheck, Eye, Repeat, Users, XCircle } from "lucide-react";

export default function SecurityPhilosophyPage() {
  return (
    <div className="max-w-3xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Scale className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-zinc-100">Security Philosophy</h1>
            <p className="text-sm text-zinc-500">How VibeCheck approaches security analysis</p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="p-6 rounded-xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/5 border border-emerald-500/20 mb-10"
      >
        <p className="text-lg text-zinc-300">
          <strong className="text-zinc-100">Security tools should find real problems, not generate noise.</strong>
        </p>
      </motion.div>

      {/* Core Principles */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mb-12"
      >
        <h2 className="text-xl font-semibold text-zinc-100 mb-6 pb-2 border-b border-zinc-800">
          Core Principles
        </h2>

        <div className="space-y-6">
          <Principle
            icon={ShieldCheck}
            title="1. Conservative by Default"
            description="VibeCheck flags issues when we have reasonable confidence they represent genuine security risks. We would rather miss a theoretical vulnerability than waste developer time on false positives."
          >
            <ul className="mt-3 space-y-1 text-sm text-zinc-400">
              <li>- Findings require multiple corroborating signals</li>
              <li>- Confidence scores reflect actual detection reliability</li>
              <li>- Severity reflects exploitability, not theoretical maximum impact</li>
            </ul>
          </Principle>

          <Principle
            icon={Eye}
            title="2. Enforcement-First"
            description="Security controls are only effective if enforced. A validation schema that exists but isn't used provides zero protection."
          >
            <p className="mt-3 text-sm text-zinc-400">
              VibeCheck specifically detects these gaps:
            </p>
            <ul className="mt-2 space-y-1 text-sm text-zinc-400">
              <li>- Authentication code that doesn&apos;t gate access</li>
              <li>- Validation logic whose output is ignored</li>
              <li>- Security imports that are never called</li>
              <li>- Comments that claim protection without implementation</li>
            </ul>
            <p className="mt-3 text-sm text-zinc-500 italic">
              We call these patterns <strong className="text-zinc-400">security hallucinations</strong>—the appearance of security without substance.
            </p>
          </Principle>

          <Principle
            icon={Repeat}
            title="3. Local-First, Privacy-Respecting"
            description="Your code never leaves your machine. VibeCheck runs entirely locally."
          >
            <ul className="mt-3 space-y-1 text-sm text-zinc-400">
              <li>- No cloud services required</li>
              <li>- No telemetry or analytics</li>
              <li>- No code uploads or sharing</li>
              <li>- Scan artifacts stay on your filesystem</li>
            </ul>
          </Principle>

          <Principle
            icon={Repeat}
            title="4. Deterministic and Reproducible"
            description="Given the same codebase, VibeCheck produces the same findings. There's no AI guessing, no probabilistic scanning, no 'it depends on the day' results."
          >
            <p className="mt-3 text-sm text-zinc-400">
              Every finding links to specific file and line numbers, the exact pattern that triggered detection, and reproducible evidence.
            </p>
          </Principle>

          <Principle
            icon={Users}
            title="5. Developer-Centric"
            description="Security tools often fail because they're built for auditors, not developers. VibeCheck is designed for the people who will actually fix the issues."
          >
            <ul className="mt-3 space-y-1 text-sm text-zinc-400">
              <li>- Clear, actionable remediation guidance</li>
              <li>- Integration with existing workflows (CLI, CI, IDE)</li>
              <li>- Findings grouped by what needs to change</li>
              <li>- Exit codes that work with automation</li>
            </ul>
          </Principle>
        </div>
      </motion.section>

      {/* What We Don't Do */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="mb-12"
      >
        <h2 className="text-xl font-semibold text-zinc-100 mb-6 pb-2 border-b border-zinc-800">
          What We Don&apos;t Do
        </h2>

        <div className="grid gap-4">
          <DontDoCard
            title="No Vulnerability Databases"
            description="We don't scan for CVEs or known vulnerabilities in dependencies. Tools like npm audit, Snyk, and Dependabot already do this. We focus on your code, not third-party packages."
          />
          <DontDoCard
            title="No AI/LLM Analysis"
            description="We don't send your code to language models for analysis. While AI can find interesting patterns, it can't provide the deterministic, reproducible results required for security tooling in CI pipelines."
          />
          <DontDoCard
            title='No "Best Practice" Noise'
            description="We don't flag stylistic issues, coding conventions, or theoretical improvements. If it's not a security problem, it's not a finding."
          />
          <DontDoCard
            title="No Severity Inflation"
            description="A medium-confidence information disclosure is not 'Critical' just because data might be sensitive. Severity reflects exploitability, authentication requirements, attack complexity, and realistic impact."
          />
        </div>
      </motion.section>

      {/* Severity Model */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="mb-12"
      >
        <h2 className="text-xl font-semibold text-zinc-100 mb-6 pb-2 border-b border-zinc-800">
          Severity Model
        </h2>

        <div className="space-y-3">
          <SeverityLevel
            level="Critical"
            color="bg-red-500"
            description="Exploitable with no authentication, leads to data breach or system compromise."
            examples={["JWT decoded without verification", "Unprotected admin endpoints", "Hardcoded secrets in production paths"]}
          />
          <SeverityLevel
            level="High"
            color="bg-orange-500"
            description="Exploitable with some preconditions, significant impact."
            examples={["Unprotected state-changing endpoints", "SSRF with user-controlled URLs", "SQL injection patterns"]}
          />
          <SeverityLevel
            level="Medium"
            color="bg-yellow-500"
            description="Requires specific conditions, limited impact, or defense-in-depth gap."
            examples={["Missing rate limiting on public endpoints", "Debug flags without environment guards", "Client-side only validation"]}
          />
          <SeverityLevel
            level="Low"
            color="bg-blue-500"
            description="Informational, hygiene issues, or minor gaps."
            examples={["Missing request timeouts", "Undocumented environment variables"]}
          />
        </div>
      </motion.section>

      {/* The Goal */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="p-6 rounded-xl bg-zinc-900/50 border border-zinc-800"
      >
        <h2 className="text-xl font-semibold text-zinc-100 mb-4">The Goal</h2>
        <p className="text-zinc-400 mb-4">
          VibeCheck exists because vibe-coding with AI assistants often produces code that <em>looks</em> secure but isn&apos;t. The patterns are familiar—validation schemas, auth checks, middleware—but the wiring is missing.
        </p>
        <p className="text-zinc-300 font-medium mb-4">
          Our goal is simple: Find the gap between intended security and actual security.
        </p>
        <div className="space-y-2 text-sm text-zinc-400">
          <p>When you run <code className="px-1.5 py-0.5 rounded bg-zinc-800 text-emerald-400 text-xs">vibecheck scan</code>, you should:</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Get a small number of high-signal findings</li>
            <li>Understand each one without security expertise</li>
            <li>Know exactly what to fix</li>
            <li>Trust that fixing them improves your security posture</li>
          </ol>
        </div>
        <p className="text-zinc-500 text-sm mt-4 italic">
          That&apos;s it. No dashboards, no compliance theater, no security scores. Just findings that matter.
        </p>
      </motion.section>
    </div>
  );
}

function Principle({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Scale;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="p-5 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Icon className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-zinc-100">{title}</h3>
          <p className="text-zinc-400 text-sm mt-1">{description}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

function DontDoCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg bg-zinc-900/30 border border-zinc-800/50">
      <XCircle className="w-5 h-5 text-zinc-600 flex-shrink-0 mt-0.5" />
      <div>
        <h4 className="text-sm font-medium text-zinc-300">{title}</h4>
        <p className="text-sm text-zinc-500 mt-1">{description}</p>
      </div>
    </div>
  );
}

function SeverityLevel({
  level,
  color,
  description,
  examples,
}: {
  level: string;
  color: string;
  description: string;
  examples: string[];
}) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
      <div className={`w-2 h-2 rounded-full ${color} mt-2 flex-shrink-0`} />
      <div>
        <span className="font-medium text-zinc-100">{level}</span>
        <p className="text-sm text-zinc-400 mt-1">{description}</p>
        <div className="flex flex-wrap gap-2 mt-2">
          {examples.map((ex) => (
            <span
              key={ex}
              className="px-2 py-0.5 rounded bg-zinc-800/50 text-xs text-zinc-500"
            >
              {ex}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
