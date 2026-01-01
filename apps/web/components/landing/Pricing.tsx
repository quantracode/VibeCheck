"use client";

import { motion } from "framer-motion";
import { Check, ArrowRight, CreditCard } from "lucide-react";

const plans = [
  {
    name: "Free",
    price: "$0",
    description: "For solo builders",
    features: [
      "Unlimited local scans",
      "All detection rules",
      "JSON & SARIF export",
      "VS Code extension",
    ],
    cta: "Get started",
    href: "/docs",
    popular: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/mo",
    description: "For serious shippers",
    features: [
      "Everything in Free",
      "Baseline tracking",
      "Regression detection",
      "Priority support",
      "Custom policies",
    ],
    cta: "Start trial",
    href: "/docs",
    popular: true,
  },
  {
    name: "Team",
    price: "$199",
    period: "/mo",
    description: "For growing teams",
    features: [
      "Everything in Pro",
      "Shared baselines",
      "CI/CD integration",
      "Team dashboards",
      "Audit trail",
    ],
    cta: "Contact us",
    href: "/docs",
    popular: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="relative px-6 py-24 lg:py-32">
      <div className="absolute inset-0 gradient-bg-subtle" />

      <div className="relative max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-800/50 border border-zinc-700/50 mb-6">
            <CreditCard className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-zinc-400">Pricing</span>
          </div>

          <h2 className="text-4xl lg:text-5xl font-bold tracking-tight">
            Start free, scale as you grow
          </h2>
          <p className="mt-4 text-lg text-zinc-400">
            Free forever for individual developers. Upgrade when you need team features.
          </p>
        </motion.div>

        {/* Plans */}
        <div className="grid lg:grid-cols-3 gap-6">
          {plans.map((plan, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={{ y: -4 }}
              className={`relative p-6 rounded-xl transition-all duration-300 ${
                plan.popular
                  ? "gradient-border"
                  : "card-elevated"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 text-xs font-semibold bg-emerald-500 text-zinc-900 rounded-full">
                    Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-semibold text-zinc-100">{plan.name}</h3>
                <p className="mt-1 text-sm text-zinc-500">{plan.description}</p>
              </div>

              <div className="mb-6">
                <span className="text-4xl font-bold text-zinc-100">{plan.price}</span>
                {plan.period && (
                  <span className="text-zinc-500">{plan.period}</span>
                )}
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, j) => (
                  <li key={j} className="flex items-center gap-3 text-sm text-zinc-300">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              <a
                href={plan.href}
                className={`group flex items-center justify-center gap-2 w-full py-3 rounded-lg font-medium transition-all ${
                  plan.popular
                    ? "btn-primary"
                    : "btn-secondary text-zinc-100"
                }`}
              >
                {plan.cta}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </a>
            </motion.div>
          ))}
        </div>

        {/* Note */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-12 text-center text-sm text-zinc-500"
        >
          All plans run locally. Your code never touches our servers.
        </motion.p>
      </div>
    </section>
  );
}
