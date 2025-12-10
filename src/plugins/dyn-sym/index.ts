import type { Plugin } from "@opencode-ai/plugin";

import { ensureSymDir, symDirExists } from "./symdir";
import { ensureSymDirExcluded } from "./gitexclude";
import { listSymlinks, addSymlink, removeSymlink, clearSymlinks } from "./symlinks";

export type { SymlinkEntry } from "./symlinks";
export { 
  ensureSymDir, 
  symDirExists, 
  getSymDirPath,
  SYM_DIR_NAME,
} from "./symdir";
export { 
  ensureSymDirExcluded, 
  removeSymDirExclude, 
  isGitRepo,
} from "./gitexclude";
export { 
  addSymlink, 
  removeSymlink, 
  listSymlinks, 
  symlinkExists, 
  clearSymlinks,
} from "./symlinks";

/**
 * Configuration for the dyn-sym plugin.
 */
export interface DynSymConfig {
  /** 
   * List of paths to automatically symlink on init.
   * Can be absolute paths or paths relative to a config location.
   */
  symlinks?: Array<{
    path: string;
    name?: string;
  }>;
}

/**
 * Dynamic Symlinks Plugin
 * 
 * Creates a .sym directory in the worktree root that can contain symlinks
 * to external directories. This allows OpenCode's ripgrep-based discovery
 * to find files in those linked directories.
 * 
 * Key features:
 * - Creates .sym directory on plugin init
 * - Adds .sym to local git exclude (.git/info/exclude) to avoid polluting .gitignore
 * - Provides API for managing symlinks programmatically
 * - Symlinks are followed by ripgrep's --follow flag
 */
export const DynSymPlugin: Plugin = async (input) => {
  const { worktree } = input;
  
  // Initialize on plugin load:
  // 1. Ensure .sym directory exists
  await ensureSymDir(worktree);
  
  // 2. Ensure .sym is in local git exclude
  await ensureSymDirExcluded(worktree);
  
  // Log current symlinks for debugging
  const currentSymlinks = await listSymlinks(worktree);
  if (currentSymlinks.length > 0) {
    console.log(`[dyn-sym] Found ${currentSymlinks.length} symlink(s) in .sym:`);
    for (const sym of currentSymlinks) {
      const status = sym.targetExists ? "ok" : "broken";
      console.log(`  - ${sym.name} -> ${sym.targetPath} (${status})`);
    }
  }
  
  // Return empty hooks for now - the plugin's value is in the init behavior
  // and exported functions. Future hooks can be added here.
  return {};
};
