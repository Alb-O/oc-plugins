export { createEditTool, editTool } from "./edit";
export { createWriteTool, writeTool } from "./write";
export { commitFile, isGitRepo, getGitRoot, type CommitResult } from "./git";
export { setNote, takeNote, type Note } from "./notes";
export { captureBeforeBash, commitAfterBash, clearSnapshot } from "./bash-tracking";
export { type GitNarrationConfig, defaultConfig } from "./config";
export { default as GitNarrationPlugin } from "./index";
