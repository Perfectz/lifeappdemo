"use client";

import { type FormEvent, useEffect, useState } from "react";

import {
  clearOpenAIClientSettings,
  getDefaultOpenAIModel,
  loadOpenAIClientSettings,
  saveOpenAIClientSettings
} from "@/client/openaiSettings";

export function OpenAISettingsPanel() {
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [isConfigured, setIsConfigured] = useState(false);
  const [model, setModel] = useState(getDefaultOpenAIModel());
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const settings = loadOpenAIClientSettings(window.localStorage);
    setIsConfigured(Boolean(settings.apiKey));
    setModel(settings.model);
  }, []);

  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const existing = loadOpenAIClientSettings(window.localStorage);
    const nextApiKey = apiKeyDraft.trim() || existing.apiKey;
    const saved = saveOpenAIClientSettings(window.localStorage, {
      apiKey: nextApiKey,
      model
    });

    setApiKeyDraft("");
    setIsConfigured(Boolean(saved.apiKey));
    setModel(saved.model);
    setMessage(saved.apiKey ? "OpenAI access token saved on this device." : "Model saved.");
  }

  function clearSettings() {
    clearOpenAIClientSettings(window.localStorage);
    setApiKeyDraft("");
    setIsConfigured(false);
    setModel(getDefaultOpenAIModel());
    setMessage("OpenAI access token cleared from this device.");
  }

  return (
    <section className="openai-settings-panel" aria-label="OpenAI access token settings">
      <p>
        Store a personal OpenAI API key on this device so the installed GitHub Pages
        PWA can make AI coach calls directly. Keep this private on devices you control.
      </p>
      <form className="settings-token-form" onSubmit={saveSettings}>
        <label>
          <span>Access token</span>
          <input
            autoComplete="off"
            onChange={(event) => setApiKeyDraft(event.target.value)}
            placeholder={isConfigured ? "Token saved. Enter a new token to replace it." : "sk-..."}
            type="password"
            value={apiKeyDraft}
          />
        </label>
        <label>
          <span>Model</span>
          <input
            onChange={(event) => setModel(event.target.value)}
            placeholder={getDefaultOpenAIModel()}
            type="text"
            value={model}
          />
        </label>
        <div className="standup-actions">
          <button type="submit">Save OpenAI Settings</button>
          <button onClick={clearSettings} type="button">
            Clear Token
          </button>
        </div>
      </form>
      <dl className="token-status">
        <div>
          <dt>Status</dt>
          <dd>{isConfigured ? "Token saved locally" : "No token saved"}</dd>
        </div>
        <div>
          <dt>Storage</dt>
          <dd>Browser localStorage</dd>
        </div>
      </dl>
      {message ? (
        <p className="standup-success" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
