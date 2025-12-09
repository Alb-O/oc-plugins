import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { spawn } from "bun";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

const OPENCODE_MODEL = "opencode/big-pickle";
const TEST_TIMEOUT = 120_000; // 120 seconds for LLM responses

interface TestContext {
  testDir: string;
  configDir: string;
}

async function setupTestDir(config: { template: string }): Promise<TestContext> {
  const testDir = await fs.mkdtemp(path.join(os.tmpdir(), "oc-bash-wrapper-test-"));
  const configDir = path.join(testDir, ".opencode");
  await fs.mkdir(configDir, { recursive: true });

  // Create plugin directory with re-export
  const pluginDir = path.join(configDir, "plugin");
  await fs.mkdir(pluginDir, { recursive: true });

  const projectRoot = path.resolve(import.meta.dir, "../../../../");
  await fs.writeFile(
    path.join(pluginDir, "index.ts"),
    `export * from "${projectRoot}/src/plugins";`
  );

  // Create bash-wrapper config
  await fs.writeFile(
    path.join(configDir, "bash-wrapper.json"),
    JSON.stringify(config)
  );

  return { testDir, configDir };
}

async function cleanupTestDir(ctx: TestContext) {
  if (ctx.testDir) {
    await fs.rm(ctx.testDir, { recursive: true, force: true });
  }
}

async function runOpencode(cwd: string, prompt: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = spawn({
    cmd: [
      "opencode",
      "run",
      "--model",
      OPENCODE_MODEL,
      "--format",
      "json",
      prompt,
    ],
    cwd,
    env: {
      ...process.env,
      OPENCODE_PERMISSION: JSON.stringify({ "*": "allow" }),
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  return { stdout, stderr, exitCode };
}

describe("bash-wrapper integration", () => {
  describe("raw template", () => {
    let ctx: TestContext;

    beforeEach(async () => {
      ctx = await setupTestDir({
        template: 'echo "WRAPPED:" && ${command}',
      });
    });

    afterEach(async () => {
      await cleanupTestDir(ctx);
    });

    it(
      "wraps bash commands with configured template",
      async () => {
        const { stdout, exitCode } = await runOpencode(
          ctx.testDir,
          'Run this exact bash command: echo "hello"'
        );

        expect(stdout).toContain("WRAPPED:");
        expect(stdout).toContain("hello");
        expect(exitCode).toBe(0);
      },
      TEST_TIMEOUT
    );
  });

  describe("quoted template", () => {
    let ctx: TestContext;

    beforeEach(async () => {
      ctx = await setupTestDir({
        template: 'bash -c "${command:quoted}"',
      });
    });

    afterEach(async () => {
      await cleanupTestDir(ctx);
    });

    it(
      "properly escapes commands with special characters",
      async () => {
        const { stdout, exitCode } = await runOpencode(
          ctx.testDir,
          'Run this exact bash command: echo "hello $USER"'
        );

        // The command should execute successfully with escaping
        expect(stdout).toContain("hello");
        expect(exitCode).toBe(0);
      },
      TEST_TIMEOUT
    );
  });
});
