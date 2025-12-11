export { setupWorktree, getWorktreeContext } from "./worktree";
export { wrapToolArgs, shouldWrapTool } from "./wrapper";
export { generateIdentity, getWorktreeName, type AgentIdentity } from "./identity";
export { setSessionWorktree, getSessionWorktree, clearSessionWorktree, hasSessionWorktree } from "./session";
export { isGitRepo, getGitRoot, ensureBranchExists, worktreeAdd, worktreeRemove, listWorktrees, worktreeExists } from "./git";
export { type AutoWorktreeConfig, defaultConfig } from "./config";
export { default as AutoWorktreePlugin } from "./index";
