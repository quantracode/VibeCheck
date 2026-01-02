import Link from "next/link";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mx-auto mb-6">
          <Shield className="w-8 h-8 text-zinc-950" />
        </div>
        <h1 className="text-4xl font-bold mb-2">404</h1>
        <p className="text-zinc-400 mb-6">Page not found</p>
        <Link href="/">
          <Button>Back to Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
