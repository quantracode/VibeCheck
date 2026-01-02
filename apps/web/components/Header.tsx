"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, LayoutDashboard, List, Moon, Sun, Route, Lightbulb, ShieldCheck, Network } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ArtifactSwitcher } from "./ArtifactSwitcher";
import { LicenseButton } from "./license";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/findings", label: "Findings", icon: List },
  { href: "/routes", label: "Routes", icon: Route },
  { href: "/intents", label: "Intents", icon: Lightbulb },
  { href: "/architecture", label: "Architecture", icon: Network },
  { href: "/gate", label: "Gate", icon: ShieldCheck },
];

export function Header() {
  const pathname = usePathname();
  const { setTheme, resolvedTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <div className="flex items-center gap-8 mr-8">
          <Link
            href="/"
            className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
          >
            <Shield className="h-7 w-7 text-primary" />
            <span className="font-bold text-xl tracking-tight">VibeCheck</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1" role="navigation" aria-label="Main">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-3">
          <ArtifactSwitcher />

          <LicenseButton />

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            className="rounded-lg"
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
        </div>
      </div>
    </header>
  );
}
