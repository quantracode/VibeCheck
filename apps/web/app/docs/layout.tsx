"use client";

import { Header } from "@/components/landing/Header";
import { DocsSidebar } from "@/components/docs/DocsSidebar";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Header />

      <div className="max-w-7xl mx-auto px-6 pt-24 pb-16">
        <div className="flex gap-12">
          {/* Sidebar */}
          <DocsSidebar />

          {/* Main content */}
          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
