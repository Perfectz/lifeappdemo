export type OpenAIClientSettings = {
  apiKey: string;
  model: string;
};

const settingsKey = "lifequest.openai.settings.v1";
const defaultModel = "gpt-4o-mini";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function getDefaultOpenAIModel(): string {
  return defaultModel;
}

export function loadOpenAIClientSettings(storage: Storage): OpenAIClientSettings {
  const fallback = {
    apiKey: "",
    model: defaultModel
  };

  try {
    const rawValue = storage.getItem(settingsKey);

    if (!rawValue) {
      return fallback;
    }

    const parsed: unknown = JSON.parse(rawValue);

    if (!isRecord(parsed)) {
      return fallback;
    }

    return {
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      model:
        typeof parsed.model === "string" && parsed.model.trim()
          ? parsed.model.trim()
          : defaultModel
    };
  } catch {
    return fallback;
  }
}

export function saveOpenAIClientSettings(
  storage: Storage,
  settings: OpenAIClientSettings
): OpenAIClientSettings {
  const normalized = {
    apiKey: settings.apiKey.trim(),
    model: settings.model.trim() || defaultModel
  };

  storage.setItem(settingsKey, JSON.stringify(normalized));
  return normalized;
}

export function clearOpenAIClientSettings(storage: Storage) {
  storage.removeItem(settingsKey);
}

export function hasOpenAIClientToken(storage: Storage): boolean {
  return Boolean(loadOpenAIClientSettings(storage).apiKey);
}
