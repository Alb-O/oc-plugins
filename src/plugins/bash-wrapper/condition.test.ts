import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { evaluateCondition } from "./condition";

describe("evaluateCondition", () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "condition-test-"));
    // Create a test file
    await fs.writeFile(path.join(testDir, "flake.nix"), "{}");
    await fs.mkdir(path.join(testDir, "subdir"), { recursive: true });
    await fs.writeFile(path.join(testDir, "subdir", "nested.txt"), "test");
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe("empty condition", () => {
    it("returns true for undefined condition", async () => {
      const result = await evaluateCondition(undefined, testDir);
      expect(result).toBe(true);
    });

    it("returns true for empty object condition", async () => {
      const result = await evaluateCondition({}, testDir);
      expect(result).toBe(true);
    });
  });

  describe("file condition", () => {
    it("returns true when file exists", async () => {
      const result = await evaluateCondition({ file: "flake.nix" }, testDir);
      expect(result).toBe(true);
    });

    it("returns false when file does not exist", async () => {
      const result = await evaluateCondition({ file: "nonexistent.txt" }, testDir);
      expect(result).toBe(false);
    });

    it("works with nested paths", async () => {
      const result = await evaluateCondition({ file: "subdir/nested.txt" }, testDir);
      expect(result).toBe(true);
    });

    it("works with absolute paths", async () => {
      const absPath = path.join(testDir, "flake.nix");
      const result = await evaluateCondition({ file: absPath }, testDir);
      expect(result).toBe(true);
    });
  });

  describe("command condition", () => {
    it("returns true for common commands", async () => {
      // 'ls' should exist on any unix system
      const result = await evaluateCondition({ command: "ls" }, testDir);
      expect(result).toBe(true);
    });

    it("returns false for nonexistent commands", async () => {
      const result = await evaluateCondition({ command: "this-command-does-not-exist-12345" }, testDir);
      expect(result).toBe(false);
    });
  });

  describe("combined conditions", () => {
    it("returns true when all conditions pass", async () => {
      const result = await evaluateCondition(
        { file: "flake.nix", command: "ls" },
        testDir
      );
      expect(result).toBe(true);
    });

    it("returns false when file condition fails", async () => {
      const result = await evaluateCondition(
        { file: "nonexistent.txt", command: "ls" },
        testDir
      );
      expect(result).toBe(false);
    });

    it("returns false when command condition fails", async () => {
      const result = await evaluateCondition(
        { file: "flake.nix", command: "this-command-does-not-exist-12345" },
        testDir
      );
      expect(result).toBe(false);
    });
  });
});
