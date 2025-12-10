import { promises as fs } from "node:fs";
import path from "node:path";

import { SYM_DIR_NAME } from "./symdir";

const IGNORE_FILE_NAME = ".ignore";
const IGNORE_CONTENT = `# Managed by dyn-sym plugin - DO NOT EDIT
# This file ensures .sym directory is visible to ripgrep
!/${SYM_DIR_NAME}/
`;

/**
 * Get the path to the .ignore file in the worktree root.
 */
export function getIgnoreFilePath(worktreeRoot: string): string {
  return path.join(worktreeRoot, IGNORE_FILE_NAME);
}

/**
 * Create the .ignore file with negation pattern for .sym.
 * This overrides .git/info/exclude and makes .sym visible to ripgrep.
 */
export async function createIgnoreFile(worktreeRoot: string): Promise<void> {
  const ignorePath = getIgnoreFilePath(worktreeRoot);
  await fs.writeFile(ignorePath, IGNORE_CONTENT, "utf-8");
}

/**
 * Remove the .ignore file.
 */
export async function removeIgnoreFile(worktreeRoot: string): Promise<void> {
  const ignorePath = getIgnoreFilePath(worktreeRoot);
  try {
    await fs.unlink(ignorePath);
  } catch (err: any) {
    if (err.code !== "ENOENT") {
      throw err;
    }
  }
}

/**
 * Check if the .ignore file exists.
 */
export async function ignoreFileExists(worktreeRoot: string): Promise<boolean> {
  const ignorePath = getIgnoreFilePath(worktreeRoot);
  try {
    await fs.access(ignorePath);
    return true;
  } catch {
    return false;
  }
}
