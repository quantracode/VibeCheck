"use client";

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  AlertCircle,
  ArrowRight,
  Upload,
  FileJson,
  CheckCircle2,
  Terminal,
  Zap,
  Lock,
  BookOpen,
  Scan,
} from "lucide-react";
import { useArtifactStore } from "@/lib/store";
import { validateArtifact } from "@vibecheck/schema";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const { artifacts, selectedArtifactId, importArtifact } = useArtifactStore();
  const selectedArtifact = useMemo(
    () => artifacts.find((a) => a.id === selectedArtifactId),
    [artifacts, selectedArtifactId]
  );

  const findings = selectedArtifact?.artifact.findings ?? [];

  const severityCounts = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    findings.forEach((f) => {
      const sev = f.severity.toLowerCase() as keyof typeof counts;
      if (sev in counts) counts[sev]++;
    });
    return counts;
  }, [findings]);

  // Upload state
  const [uploadState, setUploadState] = useState<"idle" | "dragging" | "processing" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const processFile = useCallback(
    async (file: File) => {
      setUploadState("processing");
      setErrorMessage("");

      try {
        const text = await file.text();
        const json = JSON.parse(text);
        const artifact = validateArtifact(json);
        await importArtifact(artifact, file.name.replace(/\.json$/, ""));
        setUploadState("success");
        setTimeout(() => setUploadState("idle"), 2000);
      } catch (err) {
        setUploadState("error");
        setErrorMessage(err instanceof Error ? err.message : "Failed to parse artifact");
        setTimeout(() => setUploadState("idle"), 3000);
      }
    },
    [importArtifact]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setUploadState("idle");
      const file = e.dataTransfer.files[0];
      if (file?.type === "application/json" || file?.name.endsWith(".json")) {
        processFile(file);
      } else {
        setUploadState("error");
        setErrorMessage("Please drop a JSON file");
        setTimeout(() => setUploadState("idle"), 3000);
      }
    },
    [processFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      e.target.value = "";
    },
    [processFile]
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 gradient-bg" />
        <div className="absolute inset-0 grid-bg" />
        <motion.div
          className="absolute top-1/4 left-[10%] w-96 h-96 rounded-full bg-emerald-500/5 blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-1/4 right-[10%] w-[500px] h-[500px] rounded-full bg-emerald-500/5 blur-3xl"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.5, 0.3, 0.5] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-zinc-950" />
            </div>
            <span className="text-xl font-bold tracking-tight">VibeCheck</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            <NavLink href="/" active>Dashboard</NavLink>
            <NavLink href="/findings">Findings</NavLink>
            <NavLink href="/docs">Docs</NavLink>
            <NavLink href="/docs/rules">Rules</NavLink>
          </nav>

          <div className="flex items-center gap-3">
            {selectedArtifact && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                <FileJson className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-zinc-400 max-w-[150px] truncate">
                  {selectedArtifact.name}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-800/50 border border-zinc-700/50 mb-6"
          >
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm text-zinc-400">Security Scanner</span>
          </motion.div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-4">
            <span className="text-zinc-100">Analyze your</span>{" "}
            <span className="text-gradient">security posture</span>
          </h1>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            Import your scan artifact to visualize findings, evaluate policies, and track security improvements.
          </p>
        </motion.div>

        {/* Upload Zone */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-16"
        >
          <motion.div
            className={cn(
              "relative rounded-2xl border-2 border-dashed p-12 transition-all duration-300 cursor-pointer",
              "bg-zinc-900/30 backdrop-blur-sm",
              uploadState === "dragging" && "border-emerald-500 bg-emerald-500/5 scale-[1.02]",
              uploadState === "error" && "border-red-500 bg-red-500/5",
              uploadState === "success" && "border-emerald-500 bg-emerald-500/5",
              uploadState === "idle" && "border-zinc-700/50 hover:border-zinc-600 hover:bg-zinc-900/50"
            )}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setUploadState("dragging"); }}
            onDragLeave={(e) => { e.preventDefault(); setUploadState("idle"); }}
            whileHover={{ scale: uploadState === "idle" ? 1.01 : 1 }}
          >
            {/* Animated border glow */}
            {uploadState === "success" && (
              <motion.div
                className="absolute inset-0 rounded-2xl"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ boxShadow: "0 0 60px rgba(52, 211, 153, 0.3)" }}
              />
            )}

            <div className="flex flex-col items-center gap-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={uploadState}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className={cn(
                    "w-20 h-20 rounded-2xl flex items-center justify-center",
                    uploadState === "success" ? "bg-emerald-500/20" :
                    uploadState === "error" ? "bg-red-500/20" :
                    "bg-zinc-800/50 border border-zinc-700/50"
                  )}
                >
                  {uploadState === "processing" ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <Scan className="w-10 h-10 text-emerald-400" />
                    </motion.div>
                  ) : uploadState === "success" ? (
                    <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                  ) : uploadState === "error" ? (
                    <AlertCircle className="w-10 h-10 text-red-400" />
                  ) : (
                    <Upload className="w-10 h-10 text-zinc-400" />
                  )}
                </motion.div>
              </AnimatePresence>

              <div className="text-center">
                <p className={cn(
                  "text-lg font-medium mb-2",
                  uploadState === "error" ? "text-red-400" :
                  uploadState === "success" ? "text-emerald-400" :
                  "text-zinc-200"
                )}>
                  {uploadState === "dragging" ? "Drop to import" :
                   uploadState === "processing" ? "Analyzing artifact..." :
                   uploadState === "success" ? "Import successful!" :
                   uploadState === "error" ? errorMessage :
                   "Drop your scan artifact here"}
                </p>
                {uploadState === "idle" && (
                  <p className="text-sm text-zinc-500">
                    or{" "}
                    <label className="text-emerald-400 hover:text-emerald-300 cursor-pointer font-medium">
                      browse files
                      <input
                        type="file"
                        accept=".json"
                        className="sr-only"
                        onChange={handleFileSelect}
                      />
                    </label>
                  </p>
                )}
              </div>

              {/* Terminal hint */}
              {uploadState === "idle" && (
                <div className="terminal rounded-lg px-4 py-3 font-mono text-sm">
                  <span className="text-emerald-500">$</span>{" "}
                  <span className="text-zinc-400">vibecheck scan -o scan.json</span>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>

        {/* Results Section */}
        {selectedArtifact && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-8"
          >
            {/* Summary Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 backdrop-blur-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400/20 to-emerald-600/20 border border-emerald-500/30 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">{selectedArtifact.artifact.repo?.name ?? "Scan Results"}</h2>
                  <p className="text-sm text-zinc-500">
                    {new Date(selectedArtifact.artifact.generatedAt).toLocaleDateString()} • {findings.length} findings
                  </p>
                </div>
              </div>
              <Link href="/findings">
                <Button className="gap-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-medium">
                  View All Findings
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>

            {/* Severity Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <SeverityCard severity="critical" count={severityCounts.critical} />
              <SeverityCard severity="high" count={severityCounts.high} />
              <SeverityCard severity="medium" count={severityCounts.medium} />
              <SeverityCard severity="low" count={severityCounts.low} />
              <SeverityCard severity="info" count={severityCounts.info} />
            </div>

            {/* Quick Stats */}
            <div className="grid md:grid-cols-3 gap-4">
              <StatCard
                icon={Terminal}
                label="Scanner Version"
                value={selectedArtifact.artifact.tool?.version ?? "Unknown"}
              />
              <StatCard
                icon={Zap}
                label="Artifact Version"
                value={selectedArtifact.artifact.artifactVersion}
              />
              <StatCard
                icon={Lock}
                label="Analysis Type"
                value="Static Analysis"
              />
            </div>
          </motion.div>
        )}

        {/* Empty State */}
        {!selectedArtifact && artifacts.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-center py-12"
          >
            <div className="grid md:grid-cols-3 gap-6 mt-8">
              <FeatureCard
                icon={Terminal}
                title="Run a Scan"
                description="Use the CLI to scan your codebase for security issues"
                command="npx vibecheck scan"
              />
              <FeatureCard
                icon={BookOpen}
                title="View Documentation"
                description="Learn about security rules and best practices"
                href="/docs"
              />
              <FeatureCard
                icon={Shield}
                title="Explore Rules"
                description="See all 26 security rules across 10 categories"
                href="/docs/rules"
              />
            </div>
          </motion.div>
        )}

        {/* Quick Links */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-16 grid md:grid-cols-4 gap-4"
        >
          <QuickLink href="/docs" icon={BookOpen} label="Installation" />
          <QuickLink href="/docs/security-philosophy" icon={Shield} label="Philosophy" />
          <QuickLink href="/docs/policy-engine" icon={Zap} label="Policy Engine" />
          <QuickLink href="/docs/ci-cd" icon={Terminal} label="CI/CD Integration" />
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/50 mt-24">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Shield className="w-4 h-4 text-emerald-500" />
            <span>VibeCheck — Local-first security scanning</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-zinc-500">
            <Link href="/docs/local-only-mode" className="hover:text-zinc-300 transition-colors">
              Privacy
            </Link>
            <Link href="/docs" className="hover:text-zinc-300 transition-colors">
              Documentation
            </Link>
            <Link href="/docs/rules" className="hover:text-zinc-300 transition-colors">
              Rules
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function NavLink({ href, children, active }: { href: string; children: React.ReactNode; active?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
        active
          ? "bg-zinc-800 text-zinc-100"
          : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
      )}
    >
      {children}
    </Link>
  );
}

function SeverityCard({ severity, count }: { severity: string; count: number }) {
  const config = {
    critical: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", glow: "shadow-red-500/20" },
    high: { color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30", glow: "shadow-orange-500/20" },
    medium: { color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30", glow: "shadow-yellow-500/20" },
    low: { color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", glow: "shadow-blue-500/20" },
    info: { color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/30", glow: "shadow-slate-500/20" },
  }[severity] ?? { color: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/30", glow: "" };

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      className={cn(
        "relative p-6 rounded-xl border backdrop-blur-sm transition-shadow",
        config.bg,
        config.border,
        count > 0 && `shadow-lg ${config.glow}`
      )}
    >
      <p className="text-sm text-zinc-500 capitalize mb-1">{severity}</p>
      <p className={cn("text-3xl font-bold", config.color)}>{count}</p>
      {count > 0 && severity === "critical" && (
        <motion.div
          className="absolute top-3 right-3"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <AlertCircle className="w-5 h-5 text-red-400" />
        </motion.div>
      )}
    </motion.div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Terminal; label: string; value: string }) {
  return (
    <div className="p-5 rounded-xl bg-zinc-900/50 border border-zinc-800/50 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-center">
          <Icon className="w-5 h-5 text-zinc-400" />
        </div>
        <div>
          <p className="text-xs text-zinc-500">{label}</p>
          <p className="text-sm font-medium text-zinc-200">{value}</p>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description, command, href }: {
  icon: typeof Terminal;
  title: string;
  description: string;
  command?: string;
  href?: string;
}) {
  const content = (
    <motion.div
      whileHover={{ scale: 1.02, y: -4 }}
      className="p-6 rounded-xl bg-zinc-900/50 border border-zinc-800/50 backdrop-blur-sm hover:border-zinc-700 transition-all h-full"
    >
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400/20 to-emerald-600/20 border border-emerald-500/30 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-emerald-400" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-zinc-400 mb-4">{description}</p>
      {command && (
        <div className="terminal rounded-lg px-3 py-2 font-mono text-xs">
          <span className="text-emerald-500">$</span> <span className="text-zinc-400">{command}</span>
        </div>
      )}
      {href && (
        <span className="inline-flex items-center gap-1 text-sm text-emerald-400 font-medium">
          Learn more <ArrowRight className="w-3 h-3" />
        </span>
      )}
    </motion.div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

function QuickLink({ href, icon: Icon, label }: { href: string; icon: typeof Terminal; label: string }) {
  return (
    <Link href={href}>
      <motion.div
        whileHover={{ scale: 1.02 }}
        className="flex items-center gap-3 p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/50 hover:border-zinc-700 hover:bg-zinc-900/50 transition-all"
      >
        <Icon className="w-5 h-5 text-emerald-400" />
        <span className="text-sm font-medium text-zinc-300">{label}</span>
        <ArrowRight className="w-4 h-4 text-zinc-600 ml-auto" />
      </motion.div>
    </Link>
  );
}
