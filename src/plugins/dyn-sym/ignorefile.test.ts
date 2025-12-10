import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

import {
  getIgnoreFilePath,
  createIgnoreFile,
  removeIgnoreFile,
  ignoreFileExists,
} from "./ignorefile";
import { SYM_DIR_NAME } from "./symdir";

describe("ignorefile", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "dyn-sym-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("getIgnoreFilePath", () => {
    it("should return correct path", () => {
      expect(getIgnoreFilePath("/foo/bar")).toBe("/foo/bar/.ignore");
    });
  });

  describe("createIgnoreFile", () => {
    it("should create .ignore file with negation pattern", async () => {
      await createIgnoreFile(tempDir);

      const content = await fs.readFile(
        path.join(tempDir, ".ignore"),
        "utf-8"
      );

      expect(content).toContain(`!/${SYM_DIR_NAME}/`);
      expect(content).toContain("dyn-sym plugin");
    });

    it("should overwrite existing .ignore file", async () => {
      await fs.writeFile(path.join(tempDir, ".ignore"), "old content");

      await createIgnoreFile(tempDir);

      const content = await fs.readFile(
        path.join(tempDir, ".ignore"),
        "utf-8"
      );

      expect(content).not.toContain("old content");
      expect(content).toContain(`!/${SYM_DIR_NAME}/`);
    });
  });

  describe("removeIgnoreFile", () => {
    it("should remove .ignore file", async () => {
      await createIgnoreFile(tempDir);
      expect(await ignoreFileExists(tempDir)).toBe(true);

      await removeIgnoreFile(tempDir);

      expect(await ignoreFileExists(tempDir)).toBe(false);
    });

    it("should not throw if .ignore doesn't exist", async () => {
      await expect(removeIgnoreFile(tempDir)).resolves.toBeUndefined();
    });
  });

  describe("ignoreFileExists", () => {
    it("should return false if .ignore doesn't exist", async () => {
      expect(await ignoreFileExists(tempDir)).toBe(false);
    });

    it("should return true if .ignore exists", async () => {
      await createIgnoreFile(tempDir);

      expect(await ignoreFileExists(tempDir)).toBe(true);
    });
  });
});
