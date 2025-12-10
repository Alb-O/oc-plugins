import type { Plugin } from "@opencode-ai/plugin";

import { ensureSymDir, symDirExists } from "./symdir";
import { ensureSymDirExcluded } from "./gitexclude";
import { createIgnoreFile, removeIgnoreFile } from "./ignorefile";
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
  createIgnoreFile,
  removeIgnoreFile,
  ignoreFileExists,
  getIgnoreFilePath,
} from "./ignorefile";
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
 * Tools that use ripgrep for file discovery and need .sym visibility.
 */
const RIPGREP_TOOLS = new Set(["read", "grep", "glob", "list"]);

/**
 * Track active tool calls that have .ignore files created.
 * Maps callID -> worktree path
 */
const activeIgnoreFiles = new Map<string, string>();

/**
 * Dynamic Symlinks Plugin
 * 
 * Creates a .sym directory in the worktree root that can contain symlinks
 * to external directories. This allows OpenCode's ripgrep-based discovery
 * to find files in those linked directories.
 * 
 * Key features:
 * - Creates .sym directory on plugin init
 * - Adds .sym to local git exclude (.git/info/exclude) to keep git status clean
 * - Temporarily creates .ignore file during ripgrep tool calls to make .sym visible
 * - Provides API for managing symlinks programmatically
 * - Symlinks are followed by ripgrep's --follow flag
 */
export const DynSymPlugin: Plugin = async (input) => {
  const { worktree } = input;
  
  // Initialize on plugin load:
  // 1. Ensure .sym directory exists
  await ensureSymDir(worktree);
  
  // 2. Ensure .sym is in local git exclude (keeps git status clean)
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
  
  return {
    /**
     * Before ripgrep-based tools run, create a temporary .ignore file
     * with a negation pattern that makes .sym visible despite git exclude.
     */
    "tool.execute.before": async (
      details: { tool: string; sessionID: string; callID: string },
      _state: { args: any },
    ) => {
      const toolName = details.tool.toLowerCase();
      
      if (!RIPGREP_TOOLS.has(toolName)) {
        return;
      }
      
      // Create .ignore file to make .sym visible to ripgrep
      await createIgnoreFile(worktree);
      activeIgnoreFiles.set(details.callID, worktree);
    },
    
    /**
     * After ripgrep-based tools complete, remove the temporary .ignore file.
     */
    "tool.execute.after": async (
      details: { tool: string; sessionID: string; callID: string },
      _result: { title: string; output: string; metadata: any },
    ) => {
      const worktreePath = activeIgnoreFiles.get(details.callID);
      
      if (!worktreePath) {
        return;
      }
      
      // Clean up .ignore file
      activeIgnoreFiles.delete(details.callID);
      await removeIgnoreFile(worktreePath);
    },
  };
};
