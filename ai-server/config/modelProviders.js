/**
 * Model Provider Abstraction
 * Supports: OpenAI (gpt-4o, gpt-4o-mini), Anthropic (Claude), Ollama (local)
 *
 * Add ANTHROPIC_API_KEY to .env to enable Claude.
 * Install Ollama (https://ollama.ai) and run a model to enable local mode.
 *
 * Every outbound call is bounded by REQUEST_TIMEOUT_MS so a hung provider can
 * never wedge a request (and, through it, the CorelDraw macro waiting on it).
 */

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

/** Hard ceiling for any single upstream model call. */
export const REQUEST_TIMEOUT_MS = 60_000;

/** Retries the SDKs perform on 429/5xx before giving up. */
const MAX_RETRIES = 2;

let _openai = null;
let _anthropic = null;

/** Raised when a provider is selected but its API key is missing. */
export class ProviderConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProviderConfigError";
    this.status = 503;
    this.publicMessage = message;
  }
}

/** Raised when an upstream provider fails or times out. */
export class ProviderError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "ProviderError";
    this.status = 502;
    this.publicMessage = message;
    this.cause = cause;
  }
}

function getOpenAI() {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new ProviderConfigError(
        "OpenAI is not configured. Add OPENAI_API_KEY to ai-server/.env and restart the server."
      );
    }
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: REQUEST_TIMEOUT_MS,
      maxRetries: MAX_RETRIES,
    });
  }
  return _openai;
}

function getAnthropic() {
  if (!_anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new ProviderConfigError(
        "Claude is not configured. Add ANTHROPIC_API_KEY to ai-server/.env and restart the server."
      );
    }
    _anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: REQUEST_TIMEOUT_MS,
      maxRetries: MAX_RETRIES,
    });
  }
  return _anthropic;
}

// ── Available models (shown in the model dropdowns) ─────────
export const MODEL_OPTIONS = {
  "gpt-4o": {
    type: "openai",
    model: "gpt-4o",
    label: "GPT-4o (Best Quality)",
  },
  "gpt-4o-mini": {
    type: "openai",
    model: "gpt-4o-mini",
    label: "GPT-4o Mini (Fast & Cheap)",
  },
  "claude-haiku": {
    type: "anthropic",
    // Alias rather than a dated snapshot, so the SDK always resolves the
    // current Haiku 4.5 build.
    model: "claude-haiku-4-5",
    label: "Claude Haiku (Fast)",
  },
  ollama: {
    type: "ollama",
    model: process.env.OLLAMA_MODEL || "llama3",
    label: "Local / Ollama (Private)",
  },
};

/** Model keys accepted by the API — used by the route validators. */
export const MODEL_KEYS = Object.keys(MODEL_OPTIONS);

export const DEFAULT_MODEL_KEY = "gpt-4o-mini";

/**
 * Main chat function — routes to the correct provider.
 * @param {Array<{role: string, content: string}>} messages
 * @param {string} modelKey  key from MODEL_OPTIONS
 * @returns {Promise<string>} the assistant's response text
 * @throws {ProviderConfigError|ProviderError}
 */
export async function chatComplete(messages, modelKey = DEFAULT_MODEL_KEY) {
  const provider = MODEL_OPTIONS[modelKey] ?? MODEL_OPTIONS[DEFAULT_MODEL_KEY];

  switch (provider.type) {
    case "openai": {
      const client = getOpenAI();
      let resp;
      try {
        resp = await client.chat.completions.create({
          model: provider.model,
          messages,
          temperature: 0.2,
        });
      } catch (err) {
        throw new ProviderError(describeUpstream("OpenAI", err), err);
      }
      const text = resp.choices?.[0]?.message?.content;
      if (typeof text !== "string") {
        throw new ProviderError("OpenAI returned an unexpected response shape.");
      }
      return text;
    }

    case "anthropic": {
      const client = getAnthropic();
      const systemMsg = messages.find((m) => m.role === "system")?.content ?? "";
      const userMsgs = messages.filter((m) => m.role !== "system");
      let resp;
      try {
        resp = await client.messages.create({
          model: provider.model,
          max_tokens: 2048,
          system: systemMsg,
          messages: userMsgs,
        });
      } catch (err) {
        throw new ProviderError(describeUpstream("Claude", err), err);
      }
      const text = resp.content?.find((b) => b.type === "text")?.text;
      if (typeof text !== "string") {
        throw new ProviderError("Claude returned an unexpected response shape.");
      }
      return text;
    }

    case "ollama": {
      const base = process.env.OLLAMA_URL ?? "http://localhost:11434";
      let resp;
      try {
        resp = await fetch(`${base}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: provider.model, messages, stream: false }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (err) {
        throw new ProviderError(
          `Could not reach Ollama at ${base}. Is it running?`,
          err
        );
      }
      if (!resp.ok) {
        throw new ProviderError(`Ollama returned ${resp.status} ${resp.statusText}.`);
      }
      const data = await resp.json();
      const text = data?.message?.content;
      if (typeof text !== "string") {
        throw new ProviderError("Ollama returned an unexpected response shape.");
      }
      return text;
    }

    default:
      throw new ProviderConfigError(`Unknown model key: ${modelKey}`);
  }
}

/** Returns the OpenAI client (for image generation — always OpenAI/DALL-E) */
export function getOpenAIClient() {
  return getOpenAI();
}

/**
 * Turn a provider SDK error into a message that is safe to show a designer:
 * status and provider only, never the raw SDK text (which can echo request
 * bodies, internal URLs, or fragments of the API key).
 */
export function describeUpstream(providerName, err) {
  const status = err?.status ?? err?.statusCode;
  if (err?.name === "APIUserAbortError" || err?.name === "TimeoutError" || err?.name === "AbortError") {
    return `${providerName} did not respond within ${REQUEST_TIMEOUT_MS / 1000}s. Please try again.`;
  }
  if (status === 401 || status === 403) {
    return `${providerName} rejected the API key. Check your key in ai-server/.env.`;
  }
  if (status === 429) {
    return `${providerName} rate limit reached. Wait a moment and try again.`;
  }
  if (typeof status === "number" && status >= 500) {
    return `${providerName} is temporarily unavailable (${status}). Please try again.`;
  }
  if (typeof status === "number") {
    return `${providerName} rejected the request (${status}).`;
  }
  return `Could not reach ${providerName}. Check your internet connection.`;
}

/**
 * Strips markdown code fences from AI JSON responses.
 * @param {string} raw
 * @returns {string}
 */
export function cleanJsonResponse(raw) {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
}

/**
 * Parse a model response that is expected to be a JSON array.
 * Models occasionally wrap the array in prose or an object; both are treated as
 * "no results" rather than an error, because a failed parse is not a server fault.
 * @returns {unknown[]}
 */
export function parseJsonArray(raw) {
  try {
    const parsed = JSON.parse(cleanJsonResponse(raw));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
