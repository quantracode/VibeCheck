"use client";

import { motion } from "framer-motion";
import { Shield, Github, Twitter, Book, Lock } from "lucide-react";

const links = [
  { label: "Documentation", href: "#", icon: Book },
  { label: "GitHub", href: "https://github.com", icon: Github },
  { label: "Twitter", href: "#", icon: Twitter },
];

export function LandingFooter() {
  return (
    <footer className="relative px-6 py-12 border-t border-zinc-800/50">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-col md:flex-row items-center justify-between gap-8"
        >
          {/* Logo */}
          <a href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <Shield className="w-4 h-4 text-zinc-950" />
            </div>
            <span className="font-semibold text-zinc-100">VibeCheck</span>
          </a>

          {/* Links */}
          <nav className="flex items-center gap-6">
            {links.map((link) => {
              const Icon = link.icon;
              return (
                <a
                  key={link.label}
                  href={link.href}
                  className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{link.label}</span>
                </a>
              );
            })}
          </nav>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-8 pt-8 border-t border-zinc-800/30 flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <p className="text-xs text-zinc-600">
            © {new Date().getFullYear()} VibeCheck
          </p>

          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <Lock className="w-3 h-3" />
            <span>100% local. Your code never leaves your machine.</span>
          </div>
        </motion.div>
      </div>
    </footer>
  );
}
