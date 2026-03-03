const sanitizeError = (error) => {
  const message = error instanceof Error ? error.message : String(error || "Unknown error");
  const status = Number(error?.status || 0);
  return {
    message: String(message || "Unknown error").slice(0, 240),
    status: Number.isFinite(status) ? status : 0,
  };
};

export const createSkillLedger = () => ({
  total: 0,
  fallbacks: 0,
  errors: [],
});

export const recordSkillOutcome = (ledger, outcome) => {
  if (!ledger || typeof ledger !== "object" || !outcome || typeof outcome !== "object") return;
  ledger.total += 1;
  if (outcome.fallbackUsed) {
    ledger.fallbacks += 1;
    if (outcome.error) {
      ledger.errors.push({
        name: outcome.name,
        message: outcome.error.message,
        status: outcome.error.status,
      });
      if (ledger.errors.length > 20) ledger.errors.splice(0, ledger.errors.length - 20);
    }
  }
};

export const runAgentSkill = ({ name, input, execute, fallback, validate } = {}) => {
  const skillName = String(name || "unknown_skill");
  if (typeof execute !== "function") {
    throw Object.assign(new Error(`[SkillContract] ${skillName} execute is required`), { status: 500 });
  }

  try {
    const result = execute(input);
    if (result === undefined || result === null) {
      throw Object.assign(new Error(`[SkillContract] ${skillName} returned empty result`), { status: 500 });
    }
    if (typeof validate === "function" && !validate(result)) {
      throw Object.assign(new Error(`[SkillContract] ${skillName} result validation failed`), { status: 500 });
    }

    return {
      ok: true,
      name: skillName,
      result,
      fallbackUsed: false,
      error: null,
    };
  } catch (error) {
    const safeError = sanitizeError(error);
    if (typeof fallback !== "function") {
      throw Object.assign(new Error(`[SkillContract] ${skillName} failed: ${safeError.message}`), {
        status: safeError.status || 500,
      });
    }

    return {
      ok: false,
      name: skillName,
      result: fallback({ input, error }),
      fallbackUsed: true,
      error: safeError,
    };
  }
};
