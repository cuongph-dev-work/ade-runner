import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { SkillMountSpec } from "@ade/shared";

const execFileAsync = promisify(execFile);

async function ensureExcludeEntries(excludeFilePath: string, patterns: string[]): Promise<void> {
  await fs.mkdir(path.dirname(excludeFilePath), { recursive: true });
  let existing = "";
  try {
    existing = await fs.readFile(excludeFilePath, "utf8");
  } catch {
    existing = "";
  }
  const existingLines = new Set(existing.split(/\r?\n/).map((line) => line.trim()));
  const missing = patterns.filter((p) => !existingLines.has(p));
  if (missing.length === 0) {
    return;
  }
  const prefix = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
  await fs.writeFile(excludeFilePath, `${existing}${prefix}${missing.join("\n")}\n`, "utf8");
}

export class WorktreeManager {
  async resolveRunWorkspace(params: {
    repoPath: string;
    threadId: string;
    defaultBranch: string;
    writeAllowed: boolean;
    harness: "claude-code" | "codex";
  }): Promise<string> {
    const { repoPath, threadId, defaultBranch, writeAllowed, harness } = params;
    const commonExclude = path.join(repoPath, ".git", "info", "exclude");
    await ensureExcludeEntries(commonExclude, [".ade/wt/", ".ade/", ".agents/skills/", ".agents/"]);

    const worktreePath = path.join(repoPath, ".ade", "wt", threadId);
    try {
      const stat = await fs.stat(path.join(worktreePath, ".git"));
      if (stat.isFile() || stat.isDirectory()) {
        return worktreePath;
      }
    } catch {
      // Chưa có worktree cho threadId này
    }

    if (!writeAllowed && harness === "claude-code") {
      return repoPath;
    }

    return this.ensureThreadWorktree({ repoPath, threadId, defaultBranch });
  }

  async ensureThreadWorktree(params: {
    repoPath: string;
    threadId: string;
    defaultBranch: string;
  }): Promise<string> {
    const { repoPath, threadId, defaultBranch } = params;
    const commonExclude = path.join(repoPath, ".git", "info", "exclude");
    await ensureExcludeEntries(commonExclude, [".ade/wt/", ".ade/", ".agents/skills/", ".agents/"]);

    const worktreePath = path.join(repoPath, ".ade", "wt", threadId);
    try {
      const stat = await fs.stat(path.join(worktreePath, ".git"));
      if (stat.isFile() || stat.isDirectory()) {
        return worktreePath;
      }
    } catch {
      // Chưa có worktree cho threadId này
    }

    await fs.mkdir(path.dirname(worktreePath), { recursive: true });
    const branchName = `ade/${threadId}`;

    let branchExists = false;
    try {
      await execFileAsync("git", ["show-ref", "--verify", "--quiet", `refs/heads/${branchName}`], {
        cwd: repoPath
      });
      branchExists = true;
    } catch {
      branchExists = false;
    }

    if (branchExists) {
      await execFileAsync("git", ["worktree", "add", worktreePath, branchName], { cwd: repoPath });
    } else {
      await execFileAsync("git", ["worktree", "add", "-b", branchName, worktreePath, defaultBranch], {
        cwd: repoPath
      });
    }

    const { stdout: wtGitDirRaw } = await execFileAsync("git", ["rev-parse", "--git-dir"], {
      cwd: worktreePath
    });
    const wtGitDir = path.resolve(worktreePath, wtGitDirRaw.trim());
    await ensureExcludeEntries(path.join(wtGitDir, "info", "exclude"), [
      ".agents/skills/",
      ".agents/"
    ]);

    return worktreePath;
  }

  async syncCodexWorktreeSkills(
    repoPath: string,
    worktreePath: string,
    skills: SkillMountSpec[]
  ): Promise<void> {
    const commonExclude = path.join(repoPath, ".git", "info", "exclude");
    await ensureExcludeEntries(commonExclude, [".ade/wt/", ".ade/", ".agents/skills/", ".agents/"]);

    const { stdout: wtGitDirRaw } = await execFileAsync("git", ["rev-parse", "--git-dir"], {
      cwd: worktreePath
    });
    const wtGitDir = path.resolve(worktreePath, wtGitDirRaw.trim());
    await ensureExcludeEntries(path.join(wtGitDir, "info", "exclude"), [
      ".agents/skills/",
      ".agents/"
    ]);

    const wtSkillsDir = path.join(worktreePath, ".agents", "skills");
    await fs.rm(wtSkillsDir, { recursive: true, force: true });
    await fs.mkdir(wtSkillsDir, { recursive: true });

    for (const skill of skills) {
      const dest = path.join(wtSkillsDir, skill.name);
      await fs.cp(skill.sourceDir, dest, { recursive: true });
    }
  }
}
