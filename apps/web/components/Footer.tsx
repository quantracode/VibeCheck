"use client";

import { useArtifactStore } from "@/lib/store";

export function Footer() {
  const { artifacts, selectedArtifactId } = useArtifactStore();
  const selectedArtifact = artifacts.find((a) => a.id === selectedArtifactId);
  const artifact = selectedArtifact?.artifact;

  return (
    <footer className="border-t bg-muted/30">
      <div className="container flex h-12 items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>VibeCheck Security Scanner</span>
          {artifact && (
            <>
              <span className="text-border">|</span>
              <span>
                Tool: <span className="font-mono">{artifact.tool.name} v{artifact.tool.version}</span>
              </span>
              <span className="text-border">|</span>
              <span>
                Format: <span className="font-mono">v{artifact.artifactVersion}</span>
              </span>
            </>
          )}
        </div>
        <div>
          {artifact?.generatedAt && (
            <span>
              Scanned: {new Date(artifact.generatedAt).toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </footer>
  );
}
