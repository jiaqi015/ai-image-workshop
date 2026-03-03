import fs from "node:fs";
import path from "node:path";

const PROJECT_ROOT = process.cwd();
const REPORT_DIR = path.join(PROJECT_ROOT, "quality", "reports");
const REGRESSION_REPORT = path.join(REPORT_DIR, "latest-regression-summary.json");
const SYSTEM_REPORT = path.join(REPORT_DIR, "latest-system-summary.json");

const fileExists = (targetPath) => {
  try {
    fs.accessSync(targetPath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const readJson = (targetPath) => {
  if (!fileExists(targetPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(targetPath, "utf8"));
  } catch {
    return null;
  }
};

const toIso = (value) => {
  if (!value) return "n/a";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "n/a" : date.toISOString();
};

const formatMs = (value) => {
  const ms = Number(value || 0);
  if (!Number.isFinite(ms) || ms < 0) return "n/a";
  return `${ms}ms`;
};

const write = (line = "") => {
  process.stdout.write(`${line}\n`);
};

const renderRegression = (report) => {
  if (!report) {
    write("- Regression report: missing (`quality/reports/latest-regression-summary.json`)");
    return;
  }

  const structural = report.structural || {};
  const live = report.live || {};
  const scenarios = Array.isArray(structural.scenarios) ? structural.scenarios.join(", ") : "n/a";
  const providers = Array.isArray(structural.providerFamilies) ? structural.providerFamilies.join(", ") : "n/a";
  const executed = Number(live.executed || 0);
  const passed = Number(live.passed || 0);
  const skipped = Number(live.skipped || 0);
  const liveStatus = live.enabled ? `${passed}/${executed} passed, ${skipped} skipped` : "disabled";

  write("### Regression");
  write(`- Timestamp: ${toIso(report.timestamp)}`);
  write(`- Duration: ${formatMs(report.durationMs)}`);
  write(`- Golden cases: ${Number(structural.totalCases || 0)}`);
  write(`- Scenarios: ${scenarios}`);
  write(`- Provider families: ${providers}`);
  write(`- Live provider smoke: ${liveStatus}`);
  write("");
};

const renderSystem = (report) => {
  if (!report) {
    write("- System report: missing (`quality/reports/latest-system-summary.json`)");
    return;
  }

  const totals = report.totals || {};
  const sections = report.sections && typeof report.sections === "object" ? report.sections : {};
  const failedCases = Array.isArray(report.cases) ? report.cases.filter((item) => item?.status === "failed") : [];

  write("### Full System");
  write(`- Timestamp: ${toIso(report.timestamp)}`);
  write(`- Duration: ${formatMs(report.durationMs)}`);
  write(`- Totals: ${Number(totals.passed || 0)}/${Number(totals.total || 0)} passed`);
  write("");
  write("| Section | Passed | Total | Failed |");
  write("|---|---:|---:|---:|");

  for (const [name, entry] of Object.entries(sections)) {
    write(
      `| ${name} | ${Number(entry?.passed || 0)} | ${Number(entry?.total || 0)} | ${Number(entry?.failed || 0)} |`
    );
  }
  write("");

  if (failedCases.length === 0) {
    write("- Failed cases: none");
    write("");
    return;
  }

  write("#### Failed Cases");
  for (const item of failedCases) {
    const section = String(item?.section || "unknown");
    const name = String(item?.name || "unknown");
    const message = String(item?.error || "n/a");
    write(`- [${section}] ${name}: ${message}`);
  }
  write("");
};

const main = () => {
  const regression = readJson(REGRESSION_REPORT);
  const system = readJson(SYSTEM_REPORT);

  write("## Quality Summary");
  write("");
  renderRegression(regression);
  renderSystem(system);
};

main();
