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
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <div className="flex items-center gap-10 mr-8">
          <Link
            href="/"
            className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm group"
          >
            <div className="p-1.5 rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
              <Shield className="h-6 w-6 text-primary" />
            </div>
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
                    "flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg transition-all duration-200",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/80"
                  )}
                >
                  <item.icon className={cn("w-4 h-4", isActive && "drop-shadow-sm")} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <ArtifactSwitcher />

          <LicenseButton />

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            className="rounded-lg hover:bg-accent/80"
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
        </div>
      </div>
    </header>
  );
}
