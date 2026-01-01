"use client";

import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { Problem } from "@/components/landing/Problem";
import { Features } from "@/components/landing/Features";
import { Workflow } from "@/components/landing/Workflow";
import { WhyNotSecureMode } from "@/components/landing/WhyNotSecureMode";
import { Pricing } from "@/components/landing/Pricing";
import { Philosophy } from "@/components/landing/Philosophy";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { LandingFooter } from "@/components/landing/LandingFooter";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Header />
      <Hero />
      <Problem />
      <Features />
      <Workflow />
      <WhyNotSecureMode />
      <Pricing />
      <Philosophy />
      <FinalCTA />
      <LandingFooter />
    </div>
  );
}
