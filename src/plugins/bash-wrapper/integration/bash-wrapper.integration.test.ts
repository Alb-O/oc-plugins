import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { spawn } from "bun";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

const OPENCODE_MODEL = "opencode/big-pickle";
const TEST_TIMEOUT = 10_000; // 10 seconds for LLM responses

interface TestContext {
  testDir: string;
  configDir: string;
}

interface BashWrapperConfig {
  template?: string;
  templates?: Array<{
    template: string;
    when?: { file?: string; command?: string };
  }>;
}

async function setupTestDir(
  config: BashWrapperConfig,
  options?: { createFlakeNix?: boolean }
): Promise<TestContext> {
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

  // Optionally create flake.nix
  if (options?.createFlakeNix) {
    await fs.writeFile(
      path.join(testDir, "flake.nix"),
      `{ outputs = { self }: { }; }`
    );
  }

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
  describe("simple template", () => {
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

  describe("conditional template with fallback", () => {
    describe("when condition matches", () => {
      let ctx: TestContext;

      beforeEach(async () => {
        ctx = await setupTestDir(
          {
            templates: [
              {
                template: 'echo "HAS_FLAKE:" && ${command}',
                when: { file: "flake.nix" },
              },
              {
                template: 'echo "NO_FLAKE:" && ${command}',
              },
            ],
          },
          { createFlakeNix: true }
        );
      });

      afterEach(async () => {
        await cleanupTestDir(ctx);
      });

      it(
        "uses the first matching template",
        async () => {
          const { stdout, exitCode } = await runOpencode(
            ctx.testDir,
            'Run this exact bash command: echo "test"'
          );

          expect(stdout).toContain("HAS_FLAKE:");
          expect(stdout).not.toContain("NO_FLAKE:");
          expect(exitCode).toBe(0);
        },
        TEST_TIMEOUT
      );
    });

    describe("when condition does not match", () => {
      let ctx: TestContext;

      beforeEach(async () => {
        ctx = await setupTestDir({
          templates: [
            {
              template: 'echo "HAS_FLAKE:" && ${command}',
              when: { file: "flake.nix" },
            },
            {
              template: 'echo "FALLBACK:" && ${command}',
            },
          ],
        });
        // Note: NOT creating flake.nix
      });

      afterEach(async () => {
        await cleanupTestDir(ctx);
      });

      it(
        "falls back to the next template",
        async () => {
          const { stdout, exitCode } = await runOpencode(
            ctx.testDir,
            'Run this exact bash command: echo "test"'
          );

          expect(stdout).toContain("FALLBACK:");
          expect(stdout).not.toContain("HAS_FLAKE:");
          expect(exitCode).toBe(0);
        },
        TEST_TIMEOUT
      );
    });

    describe("with command condition", () => {
      let ctx: TestContext;

      beforeEach(async () => {
        ctx = await setupTestDir({
          templates: [
            {
              template: 'echo "HAS_NONEXISTENT:" && ${command}',
              when: { command: "this-command-does-not-exist-12345" },
            },
            {
              template: 'echo "HAS_LS:" && ${command}',
              when: { command: "ls" },
            },
            {
              template: 'echo "FALLBACK:" && ${command}',
            },
          ],
        });
      });

      afterEach(async () => {
        await cleanupTestDir(ctx);
      });

      it(
        "skips template when command not available",
        async () => {
          const { stdout, exitCode } = await runOpencode(
            ctx.testDir,
            'Run this exact bash command: echo "test"'
          );

          expect(stdout).toContain("HAS_LS:");
          expect(stdout).not.toContain("HAS_NONEXISTENT:");
          expect(stdout).not.toContain("FALLBACK:");
          expect(exitCode).toBe(0);
        },
        TEST_TIMEOUT
      );
    });
  });
});
