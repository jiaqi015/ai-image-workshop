import { execSync } from "node:child_process";

const API_BASE = "https://api.github.com";

const fail = (message, code = 1) => {
  console.error(`[branch-protection] ${message}`);
  process.exit(code);
};

const parseRepoSlug = (remoteUrl) => {
  const normalized = String(remoteUrl || "").trim();
  if (!normalized) return null;

  // git@github.com:owner/repo.git
  const sshMatch = normalized.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/);
  if (sshMatch) return `${sshMatch[1]}/${sshMatch[2]}`;

  // https://github.com/owner/repo.git
  const httpsMatch = normalized.match(/^https:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?$/);
  if (httpsMatch) return `${httpsMatch[1]}/${httpsMatch[2]}`;

  return null;
};

const resolveRepoSlug = () => {
  const explicit = String(process.env.REPO_SLUG || "").trim();
  if (explicit) return explicit;
  try {
    const remote = execSync("git remote get-url origin", { encoding: "utf8" }).trim();
    const parsed = parseRepoSlug(remote);
    if (parsed) return parsed;
    return null;
  } catch {
    return null;
  }
};

const request = async ({ method, path, token, body }) => {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const details = data?.message || text || `HTTP ${response.status}`;
    fail(`${method} ${path} failed: ${details}`, 2);
  }

  return data;
};

const main = async () => {
  const repoSlug = resolveRepoSlug();
  if (!repoSlug) {
    fail("Cannot resolve repo slug. Set REPO_SLUG=owner/repo.");
  }

  const branch = String(process.env.BRANCH || "main").trim() || "main";
  const checks = String(process.env.REQUIRED_CHECKS || "quality-gate")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (checks.length === 0) {
    fail("REQUIRED_CHECKS is empty.");
  }

  const payload = {
    required_status_checks: {
      strict: true,
      contexts: checks,
    },
    enforce_admins: false,
    required_pull_request_reviews: null,
    restrictions: null,
    required_conversation_resolution: true,
    allow_force_pushes: false,
    allow_deletions: false,
    block_creations: false,
  };

  const dryRun = process.env.DRY_RUN === "1";
  if (dryRun) {
    console.log("[branch-protection] Dry run mode");
    console.log(`[branch-protection] repo=${repoSlug} branch=${branch}`);
    console.log(`[branch-protection] checks=${checks.join(",")}`);
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const token = String(process.env.GITHUB_TOKEN || "").trim();
  if (!token) {
    fail("Missing GITHUB_TOKEN. Export token with repo admin permission.");
  }

  const path = `/repos/${repoSlug}/branches/${branch}/protection`;
  const result = await request({
    method: "PUT",
    path,
    token,
    body: payload,
  });

  const applied = Array.isArray(result?.required_status_checks?.contexts)
    ? result.required_status_checks.contexts.join(",")
    : checks.join(",");

  console.log(`[branch-protection] Updated ${repoSlug}@${branch}`);
  console.log(`[branch-protection] required checks: ${applied}`);
};

await main();
