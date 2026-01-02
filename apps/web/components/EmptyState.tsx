"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  variant?: "default" | "muted" | "accent";
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = "default",
  className,
}: EmptyStateProps) {
  const variants = {
    default: {
      container: "bg-gradient-to-b from-muted/30 to-transparent",
      iconBg: "bg-muted/80 border border-border/50 shadow-sm",
    },
    muted: {
      container: "bg-muted/20",
      iconBg: "bg-muted border border-border/30",
    },
    accent: {
      container: "bg-gradient-to-b from-primary/5 to-transparent",
      iconBg: "bg-primary/10 border border-primary/20 shadow-sm shadow-primary/5",
    },
  };

  const styles = variants[variant];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn(
        "flex flex-col items-center justify-center text-center py-16 px-6 rounded-2xl",
        styles.container,
        className
      )}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className={cn(
          "flex items-center justify-center w-16 h-16 rounded-2xl mb-6",
          styles.iconBg
        )}
      >
        {icon}
      </motion.div>
      <motion.h3
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="text-lg font-semibold mb-2"
      >
        {title}
      </motion.h3>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed"
      >
        {description}
      </motion.p>
      {action && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.25 }}
        >
          {action}
        </motion.div>
      )}
    </motion.div>
  );
}
