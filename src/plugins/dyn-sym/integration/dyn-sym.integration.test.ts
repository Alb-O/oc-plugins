import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { spawn } from "bun";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

const OPENCODE_MODEL = "opencode/big-pickle";
const TEST_TIMEOUT = 30_000; // 30 seconds for LLM responses

interface TestContext {
  testDir: string;
  configDir: string;
  externalDir: string;
}

async function setupTestDir(): Promise<TestContext> {
  const testDir = await fs.mkdtemp(path.join(os.tmpdir(), "oc-dyn-sym-test-"));
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

  // Initialize git repo for exclude testing
  const gitDir = path.join(testDir, ".git");
  await fs.mkdir(path.join(gitDir, "info"), { recursive: true });

  // Create an external directory to symlink to
  const externalDir = await fs.mkdtemp(path.join(os.tmpdir(), "oc-dyn-sym-external-"));
  await fs.writeFile(path.join(externalDir, "external-file.txt"), "external content here");
  await fs.mkdir(path.join(externalDir, "subdir"));
  await fs.writeFile(path.join(externalDir, "subdir", "nested-file.txt"), "nested content");

  return { testDir, configDir, externalDir };
}

async function cleanupTestDir(ctx: TestContext) {
  if (ctx.testDir) {
    await fs.rm(ctx.testDir, { recursive: true, force: true });
  }
  if (ctx.externalDir) {
    await fs.rm(ctx.externalDir, { recursive: true, force: true });
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

describe("dyn-sym integration", () => {
  describe("plugin initialization", () => {
    let ctx: TestContext;

    beforeEach(async () => {
      ctx = await setupTestDir();
    });

    afterEach(async () => {
      await cleanupTestDir(ctx);
    });

    it(
      "creates .sym directory on plugin load",
      async () => {
        // Just run opencode briefly to trigger plugin init
        const { exitCode } = await runOpencode(
          ctx.testDir,
          'Run: echo "hello"'
        );

        expect(exitCode).toBe(0);

        // Check .sym directory was created
        const symDir = path.join(ctx.testDir, ".sym");
        const stat = await fs.stat(symDir);
        expect(stat.isDirectory()).toBe(true);
      },
      TEST_TIMEOUT
    );

    it(
      "adds .sym to git exclude on plugin load",
      async () => {
        await runOpencode(ctx.testDir, 'Run: echo "hello"');

        // Check exclude file
        const excludePath = path.join(ctx.testDir, ".git", "info", "exclude");
        const content = await fs.readFile(excludePath, "utf-8");
        
        expect(content).toContain("/.sym/");
        expect(content).toContain("dyn-sym plugin managed entries");
      },
      TEST_TIMEOUT
    );
  });

  describe("symlink discoverability", () => {
    let ctx: TestContext;

    beforeEach(async () => {
      ctx = await setupTestDir();
      
      // Pre-create .sym directory and symlink for this test
      const symDir = path.join(ctx.testDir, ".sym");
      await fs.mkdir(symDir, { recursive: true });
      await fs.symlink(ctx.externalDir, path.join(symDir, "external"));
    });

    afterEach(async () => {
      await cleanupTestDir(ctx);
    });

    it(
      "allows ripgrep to discover files through symlinks",
      async () => {
        // Ask opencode to search for content in the symlinked directory
        const { stdout, exitCode } = await runOpencode(
          ctx.testDir,
          'Use grep to search for "external content" in this directory'
        );

        expect(exitCode).toBe(0);
        // The agent should be able to find the file via the symlink
        expect(stdout).toMatch(/external|\.sym/i);
      },
      TEST_TIMEOUT
    );

    it(
      "can read files through symlinks",
      async () => {
        const { stdout, exitCode } = await runOpencode(
          ctx.testDir,
          'Read the file at .sym/external/external-file.txt and tell me what it contains.'
        );

        expect(exitCode).toBe(0);
        expect(stdout).toContain("external content");
      },
      TEST_TIMEOUT
    );
  });
});
