"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Rocket,
  Terminal,
  Settings,
  Shield,
  FileCode,
  GitBranch,
  AlertTriangle,
  ChevronRight,
  Lock,
  Scale,
  Gavel,
} from "lucide-react";

const navigation = [
  {
    title: "Getting Started",
    items: [
      { name: "Installation", href: "/docs", icon: Rocket },
      { name: "Quick Start", href: "/docs/quickstart", icon: Terminal },
      { name: "Configuration", href: "/docs/configuration", icon: Settings },
    ],
  },
  {
    title: "Core Concepts",
    items: [
      { name: "Security Philosophy", href: "/docs/security-philosophy", icon: Scale },
      { name: "Local-Only Mode", href: "/docs/local-only-mode", icon: Lock },
      { name: "Security Rules", href: "/docs/rules", icon: Shield },
      { name: "Severity Levels", href: "/docs/severity", icon: AlertTriangle },
    ],
  },
  {
    title: "Guides",
    items: [
      { name: "Policy Engine", href: "/docs/policy-engine", icon: Gavel },
      { name: "CI/CD Integration", href: "/docs/ci-cd", icon: GitBranch },
      { name: "VS Code Extension", href: "/docs/vscode", icon: FileCode },
    ],
  },
];

export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 flex-shrink-0">
      <div className="sticky top-20 pr-4">
        <nav className="space-y-8">
          {navigation.map((section, i) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.1 }}
            >
              <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                {section.title}
              </h4>
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;

                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                          isActive
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isActive ? "text-emerald-400" : "text-zinc-500 group-hover:text-zinc-400"}`} />
                        {item.name}
                        {isActive && (
                          <ChevronRight className="w-3 h-3 ml-auto" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
