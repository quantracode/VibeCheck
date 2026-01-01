"use client";

import { motion } from "framer-motion";
import { Lock, HardDrive, WifiOff, Database, Globe, Server } from "lucide-react";
import { CodeBlock } from "@/components/docs/CodeBlock";

export default function LocalOnlyModePage() {
  return (
    <div className="max-w-3xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Lock className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-zinc-100">Local-Only Mode</h1>
            <p className="text-sm text-zinc-500">Your code never leaves your machine</p>
          </div>
        </div>
      </motion.div>

      {/* Privacy Guarantee */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="p-6 rounded-xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/5 border border-emerald-500/20 mb-10"
      >
        <h2 className="text-xl font-semibold text-zinc-100 mb-3">Privacy Guarantee</h2>
        <p className="text-lg text-zinc-300 mb-4">
          <strong className="text-emerald-400">Your code never leaves your machine.</strong>
        </p>
        <div className="space-y-2 text-sm text-zinc-400">
          <p>VibeCheck does not:</p>
          <ul className="space-y-1 ml-4">
            <li className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-zinc-600" />
              Upload source code to any server
            </li>
            <li className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-zinc-600" />
              Send telemetry or analytics
            </li>
            <li className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-zinc-600" />
              Phone home for license validation
            </li>
            <li className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-zinc-600" />
              Require network access to function
            </li>
            <li className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-zinc-600" />
              Store data anywhere except your local filesystem
            </li>
          </ul>
        </div>
        <p className="text-sm text-zinc-500 mt-4 italic">
          This is by design, not by accident. Security tools that exfiltrate code create risk. We don&apos;t.
        </p>
      </motion.div>

      {/* What VibeCheck Reads */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mb-12"
      >
        <h2 className="text-xl font-semibold text-zinc-100 mb-4 pb-2 border-b border-zinc-800">
          What VibeCheck Reads
        </h2>
        <p className="text-zinc-400 mb-4">
          When you run <code className="px-1.5 py-0.5 rounded bg-zinc-800 text-emerald-400 text-xs">vibecheck scan</code>, the tool reads:
        </p>

        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-900/50">
                <th className="text-left px-4 py-3 text-zinc-300 font-semibold">File Type</th>
                <th className="text-left px-4 py-3 text-zinc-300 font-semibold">Purpose</th>
              </tr>
            </thead>
            <tbody className="text-zinc-400">
              <tr className="border-t border-zinc-800">
                <td className="px-4 py-3 font-mono text-xs text-emerald-400">*.ts, *.tsx, *.js, *.jsx</td>
                <td className="px-4 py-3">Scan for security patterns</td>
              </tr>
              <tr className="border-t border-zinc-800">
                <td className="px-4 py-3 font-mono text-xs text-emerald-400">package.json</td>
                <td className="px-4 py-3">Detect dependencies, framework</td>
              </tr>
              <tr className="border-t border-zinc-800">
                <td className="px-4 py-3 font-mono text-xs text-emerald-400">middleware.ts/js</td>
                <td className="px-4 py-3">Analyze middleware coverage</td>
              </tr>
              <tr className="border-t border-zinc-800">
                <td className="px-4 py-3 font-mono text-xs text-emerald-400">next.config.*</td>
                <td className="px-4 py-3">Check configuration</td>
              </tr>
              <tr className="border-t border-zinc-800">
                <td className="px-4 py-3 font-mono text-xs text-emerald-400">.env.example</td>
                <td className="px-4 py-3">Verify documented variables</td>
              </tr>
              <tr className="border-t border-zinc-800">
                <td className="px-4 py-3 font-mono text-xs text-emerald-400">tsconfig.json</td>
                <td className="px-4 py-3">Resolve path aliases</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-6 p-4 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
          <p className="text-sm text-zinc-400">
            VibeCheck <strong className="text-zinc-300">does not read</strong>:
          </p>
          <ul className="mt-2 space-y-1 text-sm text-zinc-500">
            <li>- <code className="text-zinc-400">.env</code> files (contains secrets)</li>
            <li>- <code className="text-zinc-400">node_modules/</code> (excluded by default)</li>
            <li>- <code className="text-zinc-400">.git/</code> directory</li>
            <li>- Build outputs (<code className="text-zinc-400">dist/</code>, <code className="text-zinc-400">.next/</code>, <code className="text-zinc-400">build/</code>)</li>
          </ul>
        </div>
      </motion.section>

      {/* What VibeCheck Writes */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="mb-12"
      >
        <h2 className="text-xl font-semibold text-zinc-100 mb-4 pb-2 border-b border-zinc-800">
          What VibeCheck Writes
        </h2>
        <p className="text-zinc-400 mb-4">
          Scan results are written to files you specify:
        </p>
        <CodeBlock
          code={`# Default output
vibecheck scan
# Creates: vibecheck-artifacts/vibecheck-scan.json

# Custom output
vibecheck scan -o ./reports/scan.json`}
          title="Terminal"
          showLineNumbers
        />

        <div className="mt-6">
          <h3 className="text-base font-semibold text-zinc-200 mb-3">Artifact Contents</h3>
          <p className="text-sm text-zinc-400 mb-3">
            The scan artifact contains:
          </p>
          <ul className="space-y-1 text-sm text-zinc-400">
            <li>- Finding details (rule ID, severity, file paths, line numbers)</li>
            <li>- Code snippets as evidence</li>
            <li>- Repository name (derived from directory name)</li>
            <li>- Hashed root path (not the actual path)</li>
          </ul>
          <p className="text-sm text-zinc-400 mt-4">
            The artifact does <strong className="text-zinc-300">not</strong> contain:
          </p>
          <ul className="mt-2 space-y-1 text-sm text-zinc-500">
            <li>- Complete source code</li>
            <li>- Environment variables or secrets</li>
            <li>- Git history or commits</li>
            <li>- User information</li>
          </ul>
        </div>
      </motion.section>

      {/* Storage Locations */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="mb-12"
      >
        <h2 className="text-xl font-semibold text-zinc-100 mb-4 pb-2 border-b border-zinc-800">
          Storage Locations
        </h2>

        <div className="grid gap-4">
          <StorageCard
            icon={HardDrive}
            title="CLI"
            description="The CLI stores nothing persistently. Each scan reads source files, writes artifacts, and exits. Configuration via command-line flags only—no hidden config files."
          />
          <StorageCard
            icon={Database}
            title="Web UI"
            description="The web UI uses browser-local storage only. All data stays in your browser. The web UI is a static site with no backend."
          >
            <div className="overflow-x-auto rounded-lg border border-zinc-800 mt-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-zinc-900/50">
                    <th className="text-left px-3 py-2 text-zinc-400 font-medium">Data</th>
                    <th className="text-left px-3 py-2 text-zinc-400 font-medium">Storage</th>
                    <th className="text-left px-3 py-2 text-zinc-400 font-medium">Purpose</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-500">
                  <tr className="border-t border-zinc-800/50">
                    <td className="px-3 py-2">Imported artifacts</td>
                    <td className="px-3 py-2">IndexedDB</td>
                    <td className="px-3 py-2">View findings locally</td>
                  </tr>
                  <tr className="border-t border-zinc-800/50">
                    <td className="px-3 py-2">Policy waivers</td>
                    <td className="px-3 py-2">localStorage</td>
                    <td className="px-3 py-2">Persist waiver decisions</td>
                  </tr>
                  <tr className="border-t border-zinc-800/50">
                    <td className="px-3 py-2">Theme preference</td>
                    <td className="px-3 py-2">localStorage</td>
                    <td className="px-3 py-2">UI settings</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </StorageCard>
        </div>
      </motion.section>

      {/* Network Behavior */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="mb-12"
      >
        <h2 className="text-xl font-semibold text-zinc-100 mb-4 pb-2 border-b border-zinc-800">
          Network Behavior
        </h2>
        <div className="p-5 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
          <div className="flex items-center gap-3 mb-3">
            <WifiOff className="w-5 h-5 text-emerald-400" />
            <span className="font-medium text-zinc-200">Zero network requests during normal operation</span>
          </div>
          <p className="text-sm text-zinc-400">
            The only network activity occurs if you:
          </p>
          <ol className="list-decimal list-inside mt-2 space-y-1 text-sm text-zinc-500 ml-2">
            <li>Install the package (<code className="text-zinc-400">npm install @vibecheck/cli</code>)</li>
            <li>Update the package (<code className="text-zinc-400">npm update</code>)</li>
          </ol>
          <p className="text-sm text-zinc-500 mt-3 italic">
            The tool itself never phones home.
          </p>
        </div>
      </motion.section>

      {/* Air-Gapped & Enterprise */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="mb-12"
      >
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-5 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
            <div className="flex items-center gap-2 mb-3">
              <Server className="w-5 h-5 text-emerald-400" />
              <h3 className="font-semibold text-zinc-200">Air-Gapped Environments</h3>
            </div>
            <p className="text-sm text-zinc-400 mb-3">
              VibeCheck works in air-gapped environments:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-sm text-zinc-500 ml-2">
              <li>Install dependencies on a connected machine</li>
              <li>Copy <code className="text-zinc-400">node_modules/</code> to the air-gapped system</li>
              <li>Run scans normally</li>
            </ol>
            <p className="text-xs text-zinc-600 mt-3">
              No license server, no activation, no network requirements.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-5 h-5 text-emerald-400" />
              <h3 className="font-semibold text-zinc-200">Enterprise Considerations</h3>
            </div>
            <div className="space-y-2 text-sm text-zinc-400">
              <p><strong className="text-zinc-300">Code Exfiltration Risk:</strong> Eliminated entirely.</p>
              <p><strong className="text-zinc-300">Audit Trail:</strong> Self-contained JSON artifacts.</p>
              <p><strong className="text-zinc-300">Compliance:</strong> Full data locality for SOC 2, HIPAA, etc.</p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* FAQ */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.7 }}
      >
        <h2 className="text-xl font-semibold text-zinc-100 mb-4 pb-2 border-b border-zinc-800">
          Questions
        </h2>
        <div className="space-y-4">
          <FAQ
            question="Do you collect anonymous usage statistics?"
            answer="No. Zero telemetry."
          />
          <FAQ
            question="Can my company audit the source?"
            answer="Yes. The codebase is designed for auditability."
          />
          <FAQ
            question="What about the web UI—does it send data anywhere?"
            answer="No. The web UI is a static Next.js export. It runs entirely in your browser with no backend."
          />
          <FAQ
            question="Can I run this on proprietary code?"
            answer="Yes. That's the point. Your code stays on your machine."
          />
        </div>
      </motion.section>
    </div>
  );
}

function StorageCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Lock;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="p-5 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-5 h-5 text-emerald-400" />
        <h3 className="font-semibold text-zinc-200">{title}</h3>
      </div>
      <p className="text-sm text-zinc-400">{description}</p>
      {children}
    </div>
  );
}

function FAQ({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="p-4 rounded-lg bg-zinc-900/30 border border-zinc-800/50">
      <p className="text-sm font-medium text-zinc-300 mb-1">Q: {question}</p>
      <p className="text-sm text-zinc-500">{answer}</p>
    </div>
  );
}
