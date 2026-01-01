"use client";

import { motion } from "framer-motion";
import { GitBranch } from "lucide-react";
import { CodeBlock } from "@/components/docs/CodeBlock";

export default function CICDPage() {
  return (
    <div className="max-w-3xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <GitBranch className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-zinc-100">CI/CD Integration</h1>
            <p className="text-sm text-zinc-500">Automate security scanning in your pipeline</p>
          </div>
        </div>
      </motion.div>

      {/* Quick Start */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mb-10"
      >
        <h2 className="text-xl font-semibold text-zinc-100 mb-4 pb-2 border-b border-zinc-800">
          Quick Start
        </h2>
        <CodeBlock
          code={`# Install
npm install -D @vibecheck/cli

# Scan with policy enforcement
npx vibecheck scan --policy strict`}
          title="Terminal"
          showLineNumbers
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <ExitCodeBadge code={0} label="Pass" color="emerald" />
          <ExitCodeBadge code={1} label="Policy violation" color="red" />
          <ExitCodeBadge code={2} label="Error" color="yellow" />
        </div>
      </motion.section>

      {/* GitHub Actions */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mb-12"
      >
        <h2 className="text-xl font-semibold text-zinc-100 mb-4 pb-2 border-b border-zinc-800">
          GitHub Actions
        </h2>

        <h3 className="text-base font-semibold text-zinc-200 mb-3">Basic Integration</h3>
        <CodeBlock
          code={`# .github/workflows/security.yml
name: Security Scan

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  vibecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run VibeCheck
        run: npx @vibecheck/cli scan --policy startup`}
          title=".github/workflows/security.yml"
          showLineNumbers
        />

        <h3 className="text-base font-semibold text-zinc-200 mt-8 mb-3">With Artifact Upload</h3>
        <CodeBlock
          code={`jobs:
  vibecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run VibeCheck
        run: npx @vibecheck/cli scan --policy startup -o vibecheck-scan.json
        continue-on-error: true
        id: scan

      - name: Upload scan artifact
        uses: actions/upload-artifact@v4
        with:
          name: vibecheck-scan
          path: vibecheck-scan.json

      - name: Fail if policy violated
        if: steps.scan.outcome == 'failure'
        run: exit 1`}
          title="With Artifacts"
          showLineNumbers
        />
      </motion.section>

      {/* GitLab CI */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="mb-12"
      >
        <h2 className="text-xl font-semibold text-zinc-100 mb-4 pb-2 border-b border-zinc-800">
          GitLab CI
        </h2>
        <CodeBlock
          code={`# .gitlab-ci.yml
vibecheck:
  stage: test
  image: node:20
  script:
    - npm ci
    - npx @vibecheck/cli scan --policy startup -o vibecheck-scan.json
  artifacts:
    paths:
      - vibecheck-scan.json
    when: always
    expire_in: 30 days
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == "main"`}
          title=".gitlab-ci.yml"
          showLineNumbers
        />
      </motion.section>

      {/* Other CI Systems */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="mb-12"
      >
        <h2 className="text-xl font-semibold text-zinc-100 mb-4 pb-2 border-b border-zinc-800">
          Other CI Systems
        </h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-base font-semibold text-zinc-200 mb-3">Azure DevOps</h3>
            <CodeBlock
              code={`# azure-pipelines.yml
trigger:
  - main

pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: NodeTool@0
    inputs:
      versionSpec: '20.x'

  - script: npm ci
    displayName: 'Install dependencies'

  - script: npx @vibecheck/cli scan --policy startup
    displayName: 'Run VibeCheck'`}
              title="azure-pipelines.yml"
              showLineNumbers
            />
          </div>

          <div>
            <h3 className="text-base font-semibold text-zinc-200 mb-3">CircleCI</h3>
            <CodeBlock
              code={`# .circleci/config.yml
version: 2.1

jobs:
  vibecheck:
    docker:
      - image: cimg/node:20.0
    steps:
      - checkout
      - run: npm ci
      - run:
          name: Run VibeCheck
          command: npx @vibecheck/cli scan --policy startup`}
              title=".circleci/config.yml"
              showLineNumbers
            />
          </div>
        </div>
      </motion.section>

      {/* CLI Reference */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="mb-12"
      >
        <h2 className="text-xl font-semibold text-zinc-100 mb-4 pb-2 border-b border-zinc-800">
          CLI Reference
        </h2>

        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-900/50">
                <th className="text-left px-4 py-3 text-zinc-300 font-semibold">Flag</th>
                <th className="text-left px-4 py-3 text-zinc-300 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody className="text-zinc-400">
              <tr className="border-t border-zinc-800">
                <td className="px-4 py-3 font-mono text-xs text-emerald-400">-o, --output &lt;file&gt;</td>
                <td className="px-4 py-3">Output artifact path</td>
              </tr>
              <tr className="border-t border-zinc-800">
                <td className="px-4 py-3 font-mono text-xs text-emerald-400">--policy [profile]</td>
                <td className="px-4 py-3">Enable policy evaluation</td>
              </tr>
              <tr className="border-t border-zinc-800">
                <td className="px-4 py-3 font-mono text-xs text-emerald-400">--baseline &lt;file&gt;</td>
                <td className="px-4 py-3">Compare against baseline scan</td>
              </tr>
              <tr className="border-t border-zinc-800">
                <td className="px-4 py-3 font-mono text-xs text-emerald-400">--format &lt;format&gt;</td>
                <td className="px-4 py-3">Output format: json (default), sarif</td>
              </tr>
              <tr className="border-t border-zinc-800">
                <td className="px-4 py-3 font-mono text-xs text-emerald-400">--quiet</td>
                <td className="px-4 py-3">Suppress stdout, only exit code</td>
              </tr>
              <tr className="border-t border-zinc-800">
                <td className="px-4 py-3 font-mono text-xs text-emerald-400">--verbose</td>
                <td className="px-4 py-3">Show detailed scan progress</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="text-base font-semibold text-zinc-200 mt-6 mb-3">Environment Variables</h3>
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-900/50">
                <th className="text-left px-4 py-3 text-zinc-300 font-semibold">Variable</th>
                <th className="text-left px-4 py-3 text-zinc-300 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody className="text-zinc-400">
              <tr className="border-t border-zinc-800">
                <td className="px-4 py-3 font-mono text-xs text-emerald-400">VIBECHECK_POLICY</td>
                <td className="px-4 py-3">Default policy profile</td>
              </tr>
              <tr className="border-t border-zinc-800">
                <td className="px-4 py-3 font-mono text-xs text-emerald-400">VIBECHECK_OUTPUT</td>
                <td className="px-4 py-3">Default output path</td>
              </tr>
              <tr className="border-t border-zinc-800">
                <td className="px-4 py-3 font-mono text-xs text-emerald-400">NO_COLOR</td>
                <td className="px-4 py-3">Disable colored output</td>
              </tr>
            </tbody>
          </table>
        </div>
      </motion.section>

      {/* Best Practices */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="mb-12"
      >
        <h2 className="text-xl font-semibold text-zinc-100 mb-4 pb-2 border-b border-zinc-800">
          Best Practices
        </h2>

        <div className="space-y-4">
          <BestPractice
            number={1}
            title="Start Permissive, Tighten Over Time"
          >
            <CodeBlock
              code={`# Week 1: Just visibility
- run: npx vibecheck scan || true

# Week 2: Block critical only
- run: npx vibecheck scan --policy startup

# Month 2: Full enforcement
- run: npx vibecheck scan --policy strict`}
              title="Gradual Rollout"
            />
          </BestPractice>

          <BestPractice
            number={2}
            title="Use Baselines for PRs"
          >
            <p className="text-sm text-zinc-400">
              Compare pull requests against the main branch baseline to catch regressions without blocking on existing issues.
            </p>
          </BestPractice>

          <BestPractice
            number={3}
            title="Archive Scan Artifacts"
          >
            <p className="text-sm text-zinc-400">
              Always save scan artifacts for audit trails, trend analysis, and debugging failures.
            </p>
          </BestPractice>

          <BestPractice
            number={4}
            title="Fail Fast"
          >
            <p className="text-sm text-zinc-400 mb-3">
              Run security scans early in the pipeline to catch issues before expensive build/test steps.
            </p>
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <span className="px-2 py-0.5 rounded bg-zinc-800">lint</span>
              <span>→</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">security</span>
              <span>→</span>
              <span className="px-2 py-0.5 rounded bg-zinc-800">test</span>
              <span>→</span>
              <span className="px-2 py-0.5 rounded bg-zinc-800">build</span>
              <span>→</span>
              <span className="px-2 py-0.5 rounded bg-zinc-800">deploy</span>
            </div>
          </BestPractice>

          <BestPractice
            number={5}
            title="Use Required Rules for Critical Controls"
          >
            <p className="text-sm text-zinc-400 mb-3">
              Some security controls should never be bypassed:
            </p>
            <CodeBlock
              code={`{
  "requiredRules": [
    "VC-AUTH-001",  // Unprotected routes
    "VC-AUTH-002",  // JWT verification
    "VC-CRYPTO-001" // Hardcoded secrets
  ]
}`}
              title="policy.json"
            />
          </BestPractice>
        </div>
      </motion.section>

      {/* SARIF Integration */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.7 }}
      >
        <h2 className="text-xl font-semibold text-zinc-100 mb-4 pb-2 border-b border-zinc-800">
          SARIF Integration
        </h2>
        <p className="text-zinc-400 mb-4">
          For GitHub Code Scanning integration, output in SARIF format:
        </p>
        <CodeBlock
          code={`- name: Run VibeCheck
  run: npx vibecheck scan --format sarif -o results.sarif
  continue-on-error: true

- name: Upload SARIF
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: results.sarif`}
          title="GitHub SARIF Upload"
          showLineNumbers
        />
        <p className="text-sm text-zinc-500 mt-3">
          This displays findings directly in GitHub&apos;s Security tab and PR file views.
        </p>
      </motion.section>
    </div>
  );
}

function ExitCodeBadge({
  code,
  label,
  color,
}: {
  code: number;
  label: string;
  color: "emerald" | "red" | "yellow";
}) {
  const colors = {
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    red: "bg-red-500/10 text-red-400 border-red-500/20",
    yellow: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  };

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${colors[color]}`}>
      <span className="font-mono text-sm font-bold">{code}</span>
      <span className="text-sm">{label}</span>
    </div>
  );
}

function BestPractice({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-5 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
      <div className="flex items-center gap-3 mb-3">
        <span className="w-6 h-6 rounded-full bg-emerald-500 text-zinc-950 text-xs font-bold flex items-center justify-center">
          {number}
        </span>
        <h3 className="font-semibold text-zinc-200">{title}</h3>
      </div>
      {children}
    </div>
  );
}
