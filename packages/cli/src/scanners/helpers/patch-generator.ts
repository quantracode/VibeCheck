import { readFileSync } from "node:fs";
import { resolvePath } from "../../utils/file-utils.js";

/**
 * Generate a unified diff patch for inserting code at the start of a function
 */
export function generateFunctionStartPatch(
  repoRoot: string,
  relPath: string,
  functionStartLine: number,
  codeToInsert: string,
  contextLines = 3
): string {
  try {
    const absPath = resolvePath(repoRoot, relPath);
    const content = readFileSync(absPath, "utf-8");
    const lines = content.split("\n");

    // Find the function body start (after the opening brace)
    let bodyStartLine = functionStartLine;
    for (let i = functionStartLine - 1; i < lines.length; i++) {
      if (lines[i].includes("{")) {
        bodyStartLine = i + 1; // Line after the opening brace
        break;
      }
    }

    // Get context lines before insertion point
    const contextBefore = lines.slice(
      Math.max(0, bodyStartLine - contextLines),
      bodyStartLine
    );

    // Get context lines after insertion point
    const contextAfter = lines.slice(
      bodyStartLine,
      Math.min(lines.length, bodyStartLine + contextLines)
    );

    // Determine indentation from the first line after opening brace
    const firstLineAfterBrace = lines[bodyStartLine];
    const indentation = firstLineAfterBrace?.match(/^(\s*)/)?.[1] || "  ";

    // Split the code to insert into lines and apply indentation
    const insertLines = codeToInsert
      .split("\n")
      .map((line) => {
        if (line.trim() === "") return "";
        return indentation + line;
      });

    // Build the unified diff
    const oldStartLine = bodyStartLine - contextBefore.length + 1;
    const oldLineCount = contextBefore.length + contextAfter.length;
    const newLineCount = oldLineCount + insertLines.length;

    const diffLines: string[] = [];
    diffLines.push(`--- a/${relPath.replace(/\\/g, "/")}`);
    diffLines.push(`+++ b/${relPath.replace(/\\/g, "/")}`);
    diffLines.push(
      `@@ -${oldStartLine},${oldLineCount} +${oldStartLine},${newLineCount} @@`
    );

    // Add context before
    for (const line of contextBefore) {
      diffLines.push(" " + line);
    }

    // Add inserted lines
    for (const line of insertLines) {
      diffLines.push("+" + line);
    }

    // Add blank line after insertion if not already present
    if (contextAfter.length > 0 && contextAfter[0].trim() !== "") {
      diffLines.push("+");
    }

    // Add context after
    for (const line of contextAfter) {
      diffLines.push(" " + line);
    }

    return diffLines.join("\n");
  } catch (error) {
    // If we can't generate a diff, return empty string
    return "";
  }
}

/**
 * Generate a unified diff patch for replacing a line or block of code
 */
export function generateReplacementPatch(
  repoRoot: string,
  relPath: string,
  startLine: number,
  endLine: number,
  replacementCode: string,
  contextLines = 3
): string {
  try {
    const absPath = resolvePath(repoRoot, relPath);
    const content = readFileSync(absPath, "utf-8");
    const lines = content.split("\n");

    // Convert to 0-indexed
    const startIdx = startLine - 1;
    const endIdx = endLine;

    // Get context lines before
    const contextBefore = lines.slice(
      Math.max(0, startIdx - contextLines),
      startIdx
    );

    // Get lines to be replaced
    const linesToReplace = lines.slice(startIdx, endIdx);

    // Get context lines after
    const contextAfter = lines.slice(
      endIdx,
      Math.min(lines.length, endIdx + contextLines)
    );

    // Determine indentation from the first line being replaced
    const firstReplacedLine = linesToReplace[0];
    const indentation = firstReplacedLine?.match(/^(\s*)/)?.[1] || "";

    // Split replacement code into lines and apply indentation
    const replacementLines = replacementCode
      .split("\n")
      .map((line) => {
        if (line.trim() === "") return "";
        // If the line already has indentation, use it; otherwise apply base indentation
        if (line.match(/^\s/)) return line;
        return indentation + line;
      });

    // Build the unified diff
    const oldStartLine = startIdx - contextBefore.length + 1;
    const oldLineCount = contextBefore.length + linesToReplace.length + contextAfter.length;
    const newLineCount = contextBefore.length + replacementLines.length + contextAfter.length;

    const diffLines: string[] = [];
    diffLines.push(`--- a/${relPath.replace(/\\/g, "/")}`);
    diffLines.push(`+++ b/${relPath.replace(/\\/g, "/")}`);
    diffLines.push(
      `@@ -${oldStartLine},${oldLineCount} +${oldStartLine},${newLineCount} @@`
    );

    // Add context before
    for (const line of contextBefore) {
      diffLines.push(" " + line);
    }

    // Add lines being removed
    for (const line of linesToReplace) {
      diffLines.push("-" + line);
    }

    // Add replacement lines
    for (const line of replacementLines) {
      diffLines.push("+" + line);
    }

    // Add context after
    for (const line of contextAfter) {
      diffLines.push(" " + line);
    }

    return diffLines.join("\n");
  } catch (error) {
    return "";
  }
}

/**
 * Generate a unified diff patch for adding an import statement
 */
export function generateImportPatch(
  repoRoot: string,
  relPath: string,
  importStatement: string
): string {
  try {
    const absPath = resolvePath(repoRoot, relPath);
    const content = readFileSync(absPath, "utf-8");
    const lines = content.split("\n");

    // Find the last import statement
    let lastImportLine = -1;
    for (let i = 0; i < lines.length; i++) {
      if (
        lines[i].trim().startsWith("import ") ||
        lines[i].trim().startsWith("const ") && lines[i].includes("require(")
      ) {
        lastImportLine = i;
      }
    }

    // If no imports found, insert at the beginning
    if (lastImportLine === -1) {
      const contextAfter = lines.slice(0, 3);

      const diffLines: string[] = [];
      diffLines.push(`--- a/${relPath.replace(/\\/g, "/")}`);
      diffLines.push(`+++ b/${relPath.replace(/\\/g, "/")}`);
      diffLines.push(`@@ -1,3 +1,4 @@`);
      diffLines.push("+" + importStatement);
      diffLines.push("+");
      for (const line of contextAfter) {
        diffLines.push(" " + line);
      }

      return diffLines.join("\n");
    }

    // Insert after the last import
    const insertLine = lastImportLine + 1;
    const contextBefore = lines.slice(Math.max(0, insertLine - 2), insertLine);
    const contextAfter = lines.slice(insertLine, Math.min(lines.length, insertLine + 2));

    const oldStartLine = insertLine - contextBefore.length + 1;
    const oldLineCount = contextBefore.length + contextAfter.length;
    const newLineCount = oldLineCount + 1;

    const diffLines: string[] = [];
    diffLines.push(`--- a/${relPath.replace(/\\/g, "/")}`);
    diffLines.push(`+++ b/${relPath.replace(/\\/g, "/")}`);
    diffLines.push(
      `@@ -${oldStartLine},${oldLineCount} +${oldStartLine},${newLineCount} @@`
    );

    for (const line of contextBefore) {
      diffLines.push(" " + line);
    }

    diffLines.push("+" + importStatement);

    for (const line of contextAfter) {
      diffLines.push(" " + line);
    }

    return diffLines.join("\n");
  } catch (error) {
    return "";
  }
}
