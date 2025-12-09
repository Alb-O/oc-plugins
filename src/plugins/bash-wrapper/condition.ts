import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Condition types for template selection.
 */
export interface Condition {
  /** Check if a file exists relative to project root */
  file?: string;
  /** Check if a command is available in PATH */
  command?: string;
}

/**
 * Check if a file exists relative to the given directory.
 */
async function checkFileExists(filePath: string, baseDir: string): Promise<boolean> {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(baseDir, filePath);
  try {
    await fs.access(fullPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a command is available in PATH.
 */
async function checkCommandExists(command: string): Promise<boolean> {
  try {
    const proc = Bun.spawn(["which", command], {
      stdout: "ignore",
      stderr: "ignore",
    });
    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Evaluate a condition against the current environment.
 * Returns true if all specified checks pass.
 * An empty/undefined condition always returns true.
 */
export async function evaluateCondition(
  condition: Condition | undefined,
  baseDir: string
): Promise<boolean> {
  if (!condition) {
    return true;
  }

  // Check file existence
  if (condition.file !== undefined) {
    const exists = await checkFileExists(condition.file, baseDir);
    if (!exists) {
      return false;
    }
  }

  // Check command availability
  if (condition.command !== undefined) {
    const exists = await checkCommandExists(condition.command);
    if (!exists) {
      return false;
    }
  }

  return true;
}
