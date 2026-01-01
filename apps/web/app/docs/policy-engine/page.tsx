"use client";

import { motion } from "framer-motion";
import { Gavel, Zap, Clock, AlertCircle } from "lucide-react";
import { CodeBlock } from "@/components/docs/CodeBlock";

export default function PolicyEnginePage() {
  return (
    <div className="max-w-3xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Gavel className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-zinc-100">Policy Engine</h1>
            <p className="text-sm text-zinc-500">Automated pass/fail decisions for CI/CD</p>
          </div>
        </div>
      </motion.div>

      {/* Overview */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mb-10"
      >
        <p className="text-zinc-400 mb-4">
          The policy engine evaluates scan findings against configurable rules to produce automated pass/fail decisions. Instead of manually reviewing findings, define policies that enforce your security requirements.
        </p>
        <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800 font-mono text-sm text-zinc-400">
          Scan Findings → Policy Rules → Pass/Fail Decision
        </div>
        <p className="text-sm text-zinc-500 mt-4">
          A policy defines thresholds (maximum allowed findings by severity), required rules (specific rules that must pass), and waivers (acknowledged findings to exclude).
        </p>
      </motion.section>

      {/* Built-in Profiles */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mb-12"
      >
        <h2 className="text-xl font-semibold text-zinc-100 mb-6 pb-2 border-b border-zinc-800">
          Built-in Profiles
        </h2>

        <div className="space-y-4">
          <ProfileCard
            name="startup"
            description="Balanced policy for early-stage projects. Blocks critical issues while allowing teams to iterate."
            isDefault
            thresholds={{
              critical: 0,
              high: 3,
              medium: 10,
              low: -1,
              info: -1,
            }}
          />

          <ProfileCard
            name="strict"
            description="Zero-tolerance policy for production-critical applications."
            thresholds={{
              critical: 0,
              high: 0,
              medium: 0,
              low: -1,
              info: -1,
            }}
          />

          <ProfileCard
            name="compliance-lite"
            description="Compliance-focused policy that requires specific security controls."
            thresholds={{
              critical: 0,
              high: 0,
              medium: 5,
              low: -1,
              info: -1,
            }}
            requiredRules={["VC-AUTH-001", "VC-AUTH-002", "VC-VAL-001"]}
          />
        </div>
      </motion.section>

      {/* Using Policies */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="mb-12"
      >
        <h2 className="text-xl font-semibold text-zinc-100 mb-4 pb-2 border-b border-zinc-800">
          Using Policies
        </h2>

        <h3 className="text-base font-semibold text-zinc-200 mb-3">CLI Usage</h3>
        <CodeBlock
          code={`# Evaluate with default profile (startup)
vibecheck scan --policy

# Evaluate with specific profile
vibecheck scan --policy strict

# Evaluate with custom policy file
vibecheck scan --policy ./my-policy.json`}
          title="Terminal"
          showLineNumbers
        />

        <h3 className="text-base font-semibold text-zinc-200 mt-6 mb-3">Exit Codes</h3>
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-900/50">
                <th className="text-left px-4 py-3 text-zinc-300 font-semibold">Code</th>
                <th className="text-left px-4 py-3 text-zinc-300 font-semibold">Meaning</th>
              </tr>
            </thead>
            <tbody className="text-zinc-400">
              <tr className="border-t border-zinc-800">
                <td className="px-4 py-3 font-mono text-emerald-400">0</td>
                <td className="px-4 py-3">Policy passed</td>
              </tr>
              <tr className="border-t border-zinc-800">
                <td className="px-4 py-3 font-mono text-red-400">1</td>
                <td className="px-4 py-3">Policy failed (thresholds exceeded)</td>
              </tr>
              <tr className="border-t border-zinc-800">
                <td className="px-4 py-3 font-mono text-yellow-400">2</td>
                <td className="px-4 py-3">Scan error</td>
              </tr>
            </tbody>
          </table>
        </div>
      </motion.section>

      {/* Custom Policies */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="mb-12"
      >
        <h2 className="text-xl font-semibold text-zinc-100 mb-4 pb-2 border-b border-zinc-800">
          Custom Policies
        </h2>

        <p className="text-zinc-400 mb-4">
          Create a JSON file with your policy definition:
        </p>

        <CodeBlock
          code={`{
  "name": "my-team-policy",
  "description": "Custom policy for our requirements",
  "thresholds": {
    "critical": 0,
    "high": 1,
    "medium": 5,
    "low": -1,
    "info": -1
  },
  "requiredRules": [
    "VC-AUTH-001",
    "VC-AUTH-002"
  ],
  "blockedRules": [
    "VC-CRYPTO-001"
  ]
}`}
          title="my-policy.json"
          showLineNumbers
        />

        <h3 className="text-base font-semibold text-zinc-200 mt-6 mb-3">Policy Fields</h3>
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-900/50">
                <th className="text-left px-4 py-3 text-zinc-300 font-semibold">Field</th>
                <th className="text-left px-4 py-3 text-zinc-300 font-semibold">Type</th>
                <th className="text-left px-4 py-3 text-zinc-300 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody className="text-zinc-400">
              <tr className="border-t border-zinc-800">
                <td className="px-4 py-3 font-mono text-xs text-emerald-400">name</td>
                <td className="px-4 py-3">string</td>
                <td className="px-4 py-3">Policy identifier</td>
              </tr>
              <tr className="border-t border-zinc-800">
                <td className="px-4 py-3 font-mono text-xs text-emerald-400">thresholds</td>
                <td className="px-4 py-3">object</td>
                <td className="px-4 py-3">Max findings per severity (<code className="text-zinc-500">-1</code> = unlimited)</td>
              </tr>
              <tr className="border-t border-zinc-800">
                <td className="px-4 py-3 font-mono text-xs text-emerald-400">requiredRules</td>
                <td className="px-4 py-3">string[]</td>
                <td className="px-4 py-3">Rules that must have zero findings</td>
              </tr>
              <tr className="border-t border-zinc-800">
                <td className="px-4 py-3 font-mono text-xs text-emerald-400">blockedRules</td>
                <td className="px-4 py-3">string[]</td>
                <td className="px-4 py-3">Rules that automatically fail if triggered</td>
              </tr>
            </tbody>
          </table>
        </div>
      </motion.section>

      {/* Waivers */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="mb-12"
      >
        <h2 className="text-xl font-semibold text-zinc-100 mb-4 pb-2 border-b border-zinc-800">
          Waivers
        </h2>

        <p className="text-zinc-400 mb-4">
          Waivers acknowledge specific findings that shouldn&apos;t block the policy. Use them for:
        </p>
        <ul className="space-y-1 text-sm text-zinc-400 mb-6">
          <li>- Accepted risks with mitigating controls</li>
          <li>- False positives in specific contexts</li>
          <li>- Findings scheduled for future remediation</li>
        </ul>

        <h3 className="text-base font-semibold text-zinc-200 mb-3">Waiver Structure</h3>
        <CodeBlock
          code={`{
  "id": "waiver-001",
  "findingId": "VC-AUTH-001-abc123",
  "reason": "Rate limiting handled at CDN layer",
  "approvedBy": "security-team",
  "expiresAt": "2025-06-01T00:00:00Z",
  "createdAt": "2024-12-01T00:00:00Z"
}`}
          title="Waiver Example"
          showLineNumbers
        />

        <div className="mt-6 p-5 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
          <h4 className="text-sm font-semibold text-zinc-200 mb-3">Waiver Best Practices</h4>
          <ol className="list-decimal list-inside space-y-2 text-sm text-zinc-400">
            <li><strong className="text-zinc-300">Always document the reason</strong> — Future you will thank past you</li>
            <li><strong className="text-zinc-300">Set expiration dates</strong> — Waivers shouldn&apos;t live forever</li>
            <li><strong className="text-zinc-300">Review regularly</strong> — Quarterly waiver audits catch stale exceptions</li>
            <li><strong className="text-zinc-300">Require approval</strong> — Track who approved each waiver</li>
          </ol>
        </div>
      </motion.section>

      {/* Regression Detection */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="mb-12"
      >
        <h2 className="text-xl font-semibold text-zinc-100 mb-4 pb-2 border-b border-zinc-800">
          Regression Detection
        </h2>

        <p className="text-zinc-400 mb-4">
          The policy engine can detect security regressions by comparing scans:
        </p>

        <CodeBlock
          code={`# Compare current scan to baseline
vibecheck scan --baseline ./previous-scan.json --policy`}
          title="Terminal"
        />

        <div className="mt-4 grid sm:grid-cols-3 gap-3">
          <RegressionCard
            icon={AlertCircle}
            title="New findings"
            description="Issues that didn't exist in the baseline"
          />
          <RegressionCard
            icon={Clock}
            title="Reopened findings"
            description="Previously fixed issues that returned"
          />
          <RegressionCard
            icon={Zap}
            title="Severity increases"
            description="Findings that became more severe"
          />
        </div>
      </motion.section>

      {/* Policy Evaluation Flow */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.7 }}
      >
        <h2 className="text-xl font-semibold text-zinc-100 mb-4 pb-2 border-b border-zinc-800">
          Policy Evaluation Flow
        </h2>

        <div className="space-y-2">
          {[
            "Load scan findings",
            "Apply waivers (remove waived findings)",
            "Check required rules (fail if any have findings)",
            "Check blocked rules (fail if any triggered)",
            "Count findings by severity",
            "Compare against thresholds",
            "Return pass/fail with details",
          ].map((step, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/30 border border-zinc-800/50"
            >
              <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <span className="text-sm text-zinc-400">{step}</span>
            </div>
          ))}
        </div>
      </motion.section>
    </div>
  );
}

function ProfileCard({
  name,
  description,
  thresholds,
  requiredRules,
  isDefault,
}: {
  name: string;
  description: string;
  thresholds: Record<string, number>;
  requiredRules?: string[];
  isDefault?: boolean;
}) {
  return (
    <div className="p-5 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
      <div className="flex items-center gap-2 mb-2">
        <code className="text-emerald-400 font-mono text-sm">{name}</code>
        {isDefault && (
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium">
            Default
          </span>
        )}
      </div>
      <p className="text-sm text-zinc-400 mb-3">{description}</p>
      <div className="flex flex-wrap gap-2">
        {Object.entries(thresholds).map(([key, value]) => (
          <span
            key={key}
            className="px-2 py-1 rounded bg-zinc-800/50 text-xs text-zinc-500"
          >
            {key}: <span className={value === 0 ? "text-red-400" : value === -1 ? "text-zinc-600" : "text-yellow-400"}>{value === -1 ? "∞" : value}</span>
          </span>
        ))}
      </div>
      {requiredRules && (
        <div className="mt-3 pt-3 border-t border-zinc-800/50">
          <span className="text-xs text-zinc-500">Required rules: </span>
          {requiredRules.map((rule) => (
            <code key={rule} className="text-xs text-zinc-400 mr-2">{rule}</code>
          ))}
        </div>
      )}
    </div>
  );
}

function RegressionCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof AlertCircle;
  title: string;
  description: string;
}) {
  return (
    <div className="p-4 rounded-lg bg-zinc-900/30 border border-zinc-800/50">
      <Icon className="w-4 h-4 text-zinc-500 mb-2" />
      <h4 className="text-sm font-medium text-zinc-300">{title}</h4>
      <p className="text-xs text-zinc-500 mt-1">{description}</p>
    </div>
  );
}
