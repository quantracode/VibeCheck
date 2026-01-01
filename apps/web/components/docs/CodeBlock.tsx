"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, Terminal } from "lucide-react";

interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
  showLineNumbers?: boolean;
}

export function CodeBlock({ code, language = "bash", title, showLineNumbers = false }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = code.split("\n");

  return (
    <div className="group relative rounded-xl overflow-hidden border border-zinc-800/50 bg-zinc-900/50">
      {/* Header */}
      {title && (
        <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/80 border-b border-zinc-800/50">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-zinc-500" />
            <span className="text-xs font-medium text-zinc-500">{title}</span>
          </div>
          <span className="text-xs text-zinc-600 font-mono">{language}</span>
        </div>
      )}

      {/* Code content */}
      <div className="relative">
        <pre className="p-4 overflow-x-auto">
          <code className="text-sm font-mono">
            {showLineNumbers ? (
              lines.map((line, i) => (
                <div key={i} className="flex">
                  <span className="w-8 text-right pr-4 text-zinc-600 select-none">
                    {i + 1}
                  </span>
                  <span className="text-zinc-100">{line}</span>
                </div>
              ))
            ) : (
              <span className="text-zinc-100">{code}</span>
            )}
          </code>
        </pre>

        {/* Copy button */}
        <motion.button
          onClick={handleCopy}
          className="absolute top-3 right-3 p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700/50 transition-colors"
          whileTap={{ scale: 0.95 }}
        >
          <AnimatePresence mode="wait">
            {copied ? (
              <motion.div
                key="check"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <Check className="w-4 h-4 text-emerald-400" />
              </motion.div>
            ) : (
              <motion.div
                key="copy"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <Copy className="w-4 h-4 text-zinc-400" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </div>
  );
}

interface InstallCommandProps {
  commands: {
    label: string;
    command: string;
    icon?: React.ReactNode;
  }[];
}

export function InstallTabs({ commands }: InstallCommandProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(commands[activeTab].command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl overflow-hidden border border-zinc-800/50 bg-zinc-900/50">
      {/* Tabs */}
      <div className="flex border-b border-zinc-800/50 bg-zinc-900/80">
        {commands.map((cmd, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === i
                ? "text-emerald-400 bg-zinc-800/50 border-b-2 border-emerald-500"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {cmd.icon}
            {cmd.label}
          </button>
        ))}
      </div>

      {/* Command display */}
      <div className="relative p-4">
        <div className="flex items-center gap-3">
          <span className="text-emerald-500 font-mono">$</span>
          <code className="text-sm font-mono text-zinc-100 flex-1">
            {commands[activeTab].command}
          </code>
          <motion.button
            onClick={handleCopy}
            className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700/50 transition-colors"
            whileTap={{ scale: 0.95 }}
          >
            <AnimatePresence mode="wait">
              {copied ? (
                <motion.div
                  key="check"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                >
                  <Check className="w-4 h-4 text-emerald-400" />
                </motion.div>
              ) : (
                <motion.div
                  key="copy"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                >
                  <Copy className="w-4 h-4 text-zinc-400" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>
    </div>
  );
}
