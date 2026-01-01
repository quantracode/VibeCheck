"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Copy, Check } from "lucide-react";

interface TerminalCommandProps {
  command: string;
  output?: string[];
  showCopy?: boolean;
  className?: string;
}

export function TerminalCommand({
  command,
  output,
  showCopy = true,
  className = "",
}: TerminalCommandProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`terminal-window rounded-lg overflow-hidden ${className}`}>
      {/* Terminal header */}
      <div className="terminal-header px-4 py-2.5 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-zinc-600" />
          <div className="w-3 h-3 rounded-full bg-zinc-600" />
          <div className="w-3 h-3 rounded-full bg-zinc-600" />
        </div>
        <span className="text-xs text-zinc-500 font-mono ml-2">terminal</span>
      </div>

      {/* Terminal body */}
      <div className="p-4 font-mono text-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-emerald-400 flex-shrink-0">$</span>
            <span className="text-zinc-100 truncate">{command}</span>
          </div>
          {showCopy && (
            <motion.button
              onClick={handleCopy}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex-shrink-0 p-1.5 rounded hover:bg-zinc-700/50 text-zinc-400 hover:text-zinc-200 transition-colors"
              aria-label="Copy command"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </motion.button>
          )}
        </div>

        {output && output.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-3 pt-3 border-t border-zinc-800/50 space-y-1"
          >
            {output.map((line, i) => (
              <div key={i} className="text-zinc-400 text-xs">
                {line}
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
