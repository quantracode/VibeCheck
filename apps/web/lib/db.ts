import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { ScanArtifact } from "@vibecheck/schema";

interface StoredArtifact {
  id: string;
  artifact: ScanArtifact;
  importedAt: string;
  name: string;
}

interface VibeCheckDB extends DBSchema {
  artifacts: {
    key: string;
    value: StoredArtifact;
    indexes: {
      "by-imported": string;
    };
  };
}

const DB_NAME = "vibecheck-artifacts";
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<VibeCheckDB> | null = null;

async function getDB(): Promise<IDBPDatabase<VibeCheckDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<VibeCheckDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const store = db.createObjectStore("artifacts", { keyPath: "id" });
      store.createIndex("by-imported", "importedAt");
    },
  });

  return dbInstance;
}

export async function saveArtifact(
  artifact: ScanArtifact,
  name?: string
): Promise<string> {
  const db = await getDB();
  const id = `artifact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const storedArtifact: StoredArtifact = {
    id,
    artifact,
    importedAt: new Date().toISOString(),
    name: name ?? artifact.repo?.name ?? `Scan ${new Date().toLocaleDateString()}`,
  };

  await db.put("artifacts", storedArtifact);
  return id;
}

export async function getArtifact(id: string): Promise<StoredArtifact | undefined> {
  const db = await getDB();
  return db.get("artifacts", id);
}

export async function getAllArtifacts(): Promise<StoredArtifact[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("artifacts", "by-imported");
  return all.reverse(); // Most recent first
}

export async function deleteArtifact(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("artifacts", id);
}

export async function clearAllArtifacts(): Promise<void> {
  const db = await getDB();
  await db.clear("artifacts");
}

export type { StoredArtifact };
