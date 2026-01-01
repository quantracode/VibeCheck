"use client";

import { useArtifactStore, type StoredArtifact } from "@/lib/store";
import { formatRelativeTime, downloadJson } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  FileJson,
  Trash2,
  Download,
  Check,
} from "lucide-react";

export function ArtifactSwitcher() {
  const { artifacts, selectedArtifactId, selectArtifact, removeArtifact } =
    useArtifactStore();

  const selectedArtifact = artifacts.find((a) => a.id === selectedArtifactId);

  if (artifacts.length === 0) {
    return null;
  }

  const handleExport = (artifact: StoredArtifact) => {
    downloadJson(
      artifact.artifact,
      `${artifact.name.replace(/\s+/g, "-").toLowerCase()}-export.json`
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 max-w-[200px]">
          <FileJson className="w-4 h-4 shrink-0" />
          <span className="truncate">
            {selectedArtifact?.name ?? "Select artifact"}
          </span>
          <ChevronDown className="w-4 h-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Imported Artifacts</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {artifacts.map((artifact) => (
          <DropdownMenuItem
            key={artifact.id}
            className="flex items-center justify-between gap-2 cursor-pointer"
            onClick={() => selectArtifact(artifact.id)}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{artifact.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatRelativeTime(artifact.importedAt)}
              </p>
            </div>
            {selectedArtifactId === artifact.id && (
              <Check className="w-4 h-4 text-primary shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
        {selectedArtifact && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 cursor-pointer"
              onClick={() => handleExport(selectedArtifact)}
            >
              <Download className="w-4 h-4" />
              Export JSON
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 cursor-pointer text-destructive focus:text-destructive"
              onClick={() => removeArtifact(selectedArtifact.id)}
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
