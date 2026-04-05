/**
 * Model Provider Abstraction
 * Supports: OpenAI (gpt-4o, gpt-4o-mini), Anthropic (Claude), Ollama (local)
 *
 * Add ANTHROPIC_API_KEY to .env to enable Claude.
 * Install Ollama (https://ollama.ai) and run a model to enable local mode.
 */

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

let _openai = null;
let _anthropic = null;

function getOpenAI() {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY)
      throw new Error("OPENAI_API_KEY is not set in your .env file.");
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

function getAnthropic() {
  if (!_anthropic) {
    if (!process.env.ANTHROPIC_API_KEY)
      throw new Error("ANTHROPIC_API_KEY is not set in your .env file.");
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

// ── Available models (shown in the VBA panel dropdown) ──────
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
    model: "claude-haiku-4-5-20251001",
    label: "Claude Haiku (Fast)",
  },
  ollama: {
    type: "ollama",
    model: process.env.OLLAMA_MODEL || "llama3",
    label: "Local / Ollama (Private)",
  },
};

/**
 * Main chat function — routes to the correct provider.
 * @param {Array}  messages  - Array of {role, content} message objects
 * @param {string} modelKey  - Key from MODEL_OPTIONS (default: gpt-4o-mini)
 * @returns {Promise<string>} - The assistant's response text
 */
export async function chatComplete(messages, modelKey = "gpt-4o-mini") {
  const provider = MODEL_OPTIONS[modelKey] ?? MODEL_OPTIONS["gpt-4o-mini"];

  switch (provider.type) {
    case "openai": {
      const client = getOpenAI();
      const resp = await client.chat.completions.create({
        model: provider.model,
        messages,
        temperature: 0.2,
      });
      return resp.choices[0].message.content;
    }

    case "anthropic": {
      const client = getAnthropic();
      const systemMsg = messages.find((m) => m.role === "system")?.content ?? "";
      const userMsgs = messages.filter((m) => m.role !== "system");
      const resp = await client.messages.create({
        model: provider.model,
        max_tokens: 2048,
        system: systemMsg,
        messages: userMsgs,
      });
      return resp.content[0].text;
    }

    case "ollama": {
      const url = `${process.env.OLLAMA_URL ?? "http://localhost:11434"}/api/chat`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: provider.model, messages, stream: false }),
      });
      if (!resp.ok) throw new Error(`Ollama error: ${resp.statusText}`);
      const data = await resp.json();
      return data.message.content;
    }

    default:
      throw new Error(`Unknown model key: ${modelKey}`);
  }
}

/** Returns the OpenAI client (for image generation — always OpenAI/DALL-E) */
export function getOpenAIClient() {
  return getOpenAI();
}

/** Strips markdown code fences from AI JSON responses */
export function cleanJsonResponse(raw) {
  return raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
}
