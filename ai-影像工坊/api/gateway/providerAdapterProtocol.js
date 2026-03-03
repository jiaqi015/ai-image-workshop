const REQUIRED_TASKS = ["chat", "generate", "image"];

const buildAdapterError = (provider, message) =>
  Object.assign(new Error(`[ProviderAdapter:${provider}] ${message}`), { status: 500 });

export const validateProviderAdapter = (provider, adapter) => {
  if (!adapter || typeof adapter !== "object") {
    throw buildAdapterError(provider, "adapter 缺失或类型无效");
  }

  for (const task of REQUIRED_TASKS) {
    if (typeof adapter[task] !== "function") {
      throw buildAdapterError(provider, `缺少任务实现: ${task}`);
    }
  }

  return adapter;
};

export const getProviderTaskRunner = ({ provider, adapter, task }) => {
  const normalizedTask = String(task || "").trim();
  if (!REQUIRED_TASKS.includes(normalizedTask)) {
    throw buildAdapterError(provider, `未知任务类型: ${normalizedTask || "<empty>"}`);
  }

  const validAdapter = validateProviderAdapter(provider, adapter);
  const runner = validAdapter[normalizedTask];
  if (typeof runner !== "function") {
    throw buildAdapterError(provider, `任务未实现: ${normalizedTask}`);
  }

  return runner;
};
