"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface MarkdownContentProps {
  children: ReactNode;
}

export function MarkdownContent({ children }: MarkdownContentProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="prose prose-invert prose-zinc max-w-none
        prose-headings:text-zinc-100 prose-headings:font-semibold
        prose-h1:text-3xl prose-h1:mb-4 prose-h1:mt-0
        prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-zinc-800
        prose-h3:text-lg prose-h3:mt-8 prose-h3:mb-3
        prose-h4:text-base prose-h4:mt-6 prose-h4:mb-2
        prose-p:text-zinc-400 prose-p:leading-relaxed
        prose-a:text-emerald-400 prose-a:no-underline hover:prose-a:underline
        prose-strong:text-zinc-200 prose-strong:font-semibold
        prose-code:text-emerald-400 prose-code:bg-zinc-800/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none
        prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800 prose-pre:rounded-lg
        prose-ul:text-zinc-400 prose-ol:text-zinc-400
        prose-li:marker:text-zinc-600
        prose-table:text-sm
        prose-th:text-zinc-300 prose-th:font-semibold prose-th:bg-zinc-900/50 prose-th:px-4 prose-th:py-2
        prose-td:text-zinc-400 prose-td:px-4 prose-td:py-2 prose-td:border-t prose-td:border-zinc-800
        prose-blockquote:border-emerald-500/50 prose-blockquote:bg-emerald-500/5 prose-blockquote:rounded-r-lg prose-blockquote:py-1 prose-blockquote:text-zinc-400
        prose-hr:border-zinc-800"
    >
      {children}
    </motion.div>
  );
}
