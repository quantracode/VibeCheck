"use client";

import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileJson, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { validateArtifact } from "@vibecheck/schema";
import { useArtifactStore } from "@/lib/store";

interface UploadDropzoneProps {
  onSuccess?: () => void;
  className?: string;
  compact?: boolean;
}

type UploadState = "idle" | "dragging" | "processing" | "success" | "error";

export function UploadDropzone({ onSuccess, className, compact = false }: UploadDropzoneProps) {
  const [state, setState] = useState<UploadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const { importArtifact } = useArtifactStore();

  const processFile = useCallback(
    async (file: File) => {
      setState("processing");
      setErrorMessage("");

      try {
        const text = await file.text();
        const json = JSON.parse(text);
        const artifact = validateArtifact(json);

        await importArtifact(artifact, file.name.replace(/\.json$/, ""));
        setState("success");

        setTimeout(() => {
          setState("idle");
          onSuccess?.();
        }, 1500);
      } catch (err) {
        setState("error");
        setErrorMessage(
          err instanceof Error ? err.message : "Failed to parse artifact"
        );

        setTimeout(() => {
          setState("idle");
        }, 3000);
      }
    },
    [importArtifact, onSuccess]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setState("idle");

      const file = e.dataTransfer.files[0];
      if (file && file.type === "application/json") {
        processFile(file);
      } else {
        setState("error");
        setErrorMessage("Please drop a JSON file");
        setTimeout(() => setState("idle"), 3000);
      }
    },
    [processFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setState("dragging");
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setState("idle");
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        processFile(file);
      }
      e.target.value = "";
    },
    [processFile]
  );

  const iconSize = compact ? "w-6 h-6" : "w-10 h-10";

  const getIcon = () => {
    switch (state) {
      case "processing":
        return (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <FileJson className={cn(iconSize, "text-primary")} />
          </motion.div>
        );
      case "success":
        return <CheckCircle2 className={cn(iconSize, "text-success")} />;
      case "error":
        return <AlertCircle className={cn(iconSize, "text-destructive")} />;
      default:
        return (
          <Upload
            className={cn(
              iconSize,
              "transition-colors",
              state === "dragging" ? "text-primary" : "text-muted-foreground"
            )}
          />
        );
    }
  };

  const getMessage = () => {
    switch (state) {
      case "dragging":
        return "Drop to import";
      case "processing":
        return "Validating artifact...";
      case "success":
        return "Artifact imported successfully!";
      case "error":
        return errorMessage || "Import failed";
      default:
        return (
          <>
            Drag and drop a scan artifact, or{" "}
            <label className="text-primary hover:underline cursor-pointer font-medium">
              browse
              <input
                id="file-upload-input"
                type="file"
                accept=".json,application/json"
                className="sr-only"
                onChange={handleFileSelect}
              />
            </label>
          </>
        );
    }
  };

  return (
    <motion.div
      className={cn(
        "relative border-2 border-dashed rounded-lg transition-colors text-center",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        compact ? "p-4" : "p-8",
        state === "dragging" && "border-primary bg-primary/5",
        state === "error" && "border-destructive bg-destructive/5",
        state === "success" && "border-success bg-success/5",
        state === "idle" && "border-muted-foreground/25 hover:border-muted-foreground/50",
        className
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      initial={false}
      animate={{
        scale: state === "dragging" ? 1.01 : 1,
      }}
      transition={{ duration: 0.15 }}
      role="button"
      tabIndex={0}
      aria-label="Upload artifact file"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          document.getElementById("file-upload-input")?.click();
        }
      }}
    >
      <div className={cn("flex items-center gap-3", compact ? "flex-row" : "flex-col")}>
        <AnimatePresence mode="wait">
          <motion.div
            key={state}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
          >
            {getIcon()}
          </motion.div>
        </AnimatePresence>

        <p
          className={cn(
            "text-sm",
            state === "error" ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {getMessage()}
        </p>
      </div>
    </motion.div>
  );
}
