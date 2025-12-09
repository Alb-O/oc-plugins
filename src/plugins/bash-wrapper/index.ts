import type { Plugin } from "@opencode-ai/plugin";
import { loadConfig } from "../../lib/config";
import { applyTemplate } from "./template";

/**
 * Configuration for the bash wrapper plugin.
 *
 * Create a config file at:
 *   - .opencode/bash-wrapper.json (project-local, takes priority)
 *   - ~/.config/opencode/bash-wrapper.json (global fallback)
 *
 * Example configs:
 *
 * For nix-shell (needs quoted command):
 * {
 *   "template": "nix-shell --run \"${command:quoted}\""
 * }
 *
 * For docker exec (raw command as args):
 * {
 *   "template": "docker exec -it mycontainer ${command}"
 * }
 *
 * For ssh (single-quoted to prevent remote expansion):
 * {
 *   "template": "ssh host '${command:single}'"
 * }
 *
 * Placeholders:
 *   ${command}        - raw command, no escaping
 *   ${command:quoted} - escaped for double quotes (\, ", `, $ are escaped)
 *   ${command:single} - escaped for single quotes (' becomes '\'')
 */
export interface BashWrapperConfig {
  /** Template string with ${command} placeholder */
  template?: string;
}

const CONFIG_FILE = "bash-wrapper.json";

/**
 * Plugin that wraps all bash commands using a configurable template.
 */
export const BashWrapperPlugin: Plugin = async (input) => {
  const config = await loadConfig<BashWrapperConfig>(CONFIG_FILE, input.directory);
  const template = config?.template;

  // Skip if no template configured
  if (!template) {
    return {};
  }

  return {
    "tool.execute.before": async (
      details: { tool: string; sessionID: string; callID: string },
      state: { args: any },
    ) => {
      if (!state?.args || typeof state.args !== "object") {
        return;
      }

      if (details.tool.toLowerCase() !== "bash") {
        return;
      }

      const command = state.args.command;
      if (typeof command !== "string" || !command.trim()) {
        return;
      }

      state.args.command = applyTemplate(template, command);
    },
  };
};
