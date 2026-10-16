import React from "react";
import { createRoot } from "react-dom/client";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import translations from "../src/i18n/locales/en/translation.json";
import SynapseLiveOverlay from "../src/overlay/SynapseLiveOverlay";
import "../src/overlay/RecordingOverlay.css";
import SynapseWorkspace from "../src/components/synapse/SynapseWorkspace";
import { useSettingsStore } from "../src/stores/settingsStore";
import type {
  WorkspaceApi,
  Transcript,
  Guidance,
} from "../src/lib/synapse/api";
import "../src/App.css";

i18n.use(initReactI18next).init({
  lng: "en",
  resources: { en: { translation: translations } },
  interpolation: { escapeValue: false },
});
useSettingsStore.setState({
  isLoading: false,
  settings: {
    selected_model: "whisper-small",
    post_process_provider_id: "custom",
    post_process_providers: [
      {
        id: "custom",
        label: "Local AI",
        base_url: "http://localhost:11434/v1",
        allow_base_url_edit: true,
      },
    ],
    post_process_models: { custom: "qwen3:4b" },
  },
});
const listeners = new Set<(event: Transcript) => void>();
const callback = (event: Transcript) =>
  listeners.forEach((listener) => listener(event));
let id = "";
let resolveStart: (() => void) | undefined;
let resolveGuidance: ((value: Guidance) => void) | undefined;
const controls = {
  startError: false,
  plainStart: () => {
    id = "shortcut-plain_dictation-test";
    callback({
      session_id: id,
      phase: "recording",
      guidance_enabled: false,
      mode: {
        id: "plain",
        label: "Plain dictation",
        description: "Only transcription",
        instructions: "",
      },
      committed: "",
      tentative: "",
    });
  },
  shortcutStart: () => {
    id = "shortcut-test";
    callback({
      session_id: id,
      phase: "recording",
      mode: {
        id: "prompt",
        label: "AI prompt",
        description: "Prepare an AI prompt",
        instructions: "Preserve all facts",
      },
      available_modes: [
        {
          id: "prompt",
          label: "AI prompt",
          description: "Request",
          instructions: "Preserve facts",
        },
        {
          id: "message",
          label: "Message",
          description: "Message",
          instructions: "Write a message",
        },
      ],
      guidance_enabled: true,
      committed: "",
      tentative: "",
    });
  },
  shortcutFinish: () =>
    callback({
      session_id: id,
      phase: "finished",
      committed: "A shortcut transcript.",
      tentative: "",
      output: "A corrected shortcut transcript.",
    }),
  deferStart: false,
  resolveStart: () => resolveStart?.(),
  startArgs: null as unknown,
  lastMode: "",
  guidanceCalls: 0,
  guidanceAuthError: false,
  canceled: 0,
  copied: "",
  emit: (committed: string, tentative = "", session_id = id) =>
    callback({ committed, tentative, session_id }),
  failStream: () =>
    callback({
      session_id: id,
      committed: "",
      tentative: "",
      error: "Deepgram disconnected",
    }),
  resolve: () =>
    resolveGuidance?.({
      outline: ["Task: review the interface.", "Output: specific changes."],
      next_steps: ["Confirm the audience.", "Choose the output format."],
      good_practices: ["You stated a concrete task."],
      missing: ["Who is the intended audience?"],
      deep_dive: [],
    }),
};
Object.assign(window, { synapseTest: controls });
const api: WorkspaceApi = {
  selectMode: async (id) =>
    callback({
      phase: "mode",
      mode: {
        id,
        label: id === "message" ? "Message" : "AI prompt",
        description: "Task",
        instructions: "Preserve facts",
      },
      committed: "",
      tentative: "",
    }),
  setInterval: async (seconds) =>
    callback({
      phase: "interval",
      guidance_interval_seconds: seconds,
      committed: "",
      tentative: "",
    }),
  setGuidance: async (enabled) =>
    callback({
      phase: "guidance",
      guidance_enabled: enabled,
      committed: "",
      tentative: "",
    }),
  preview: async () => {},
  dismiss: async () =>
    callback({ phase: "hidden", committed: "", tentative: "" }),
  configure: async () => {},
  stopShortcut: async () => {
    controls.shortcutFinish();
  },
  copy: async (text) => {
    controls.copied = text;
  },
  subscribe: async (listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  start: async (args) => {
    controls.startArgs = args;
    id = args.sessionId;
    if (controls.startError) throw new Error("Microphone unavailable");
    if (controls.deferStart)
      await new Promise<void>((resolve) => {
        resolveStart = resolve;
      });
  },
  stop: async () => "Build a search tool for our support team.",
  cancel: async () => {
    controls.canceled++;
  },
  guidance: async (_text, mode) => {
    controls.guidanceCalls++;
    if (controls.guidanceAuthError)
      throw new Error(
        "Authentication failed for test provider (HTTP 401). Check the API key.",
      );
    controls.lastMode = mode.id;
    return new Promise((resolve) => {
      resolveGuidance = resolve;
    });
  },
  rewrite: async (text, instructions) =>
    `${instructions.startsWith("You are") ? "Prepared" : "Custom"}: ${text}`,
};
createRoot(document.getElementById("root")!).render(
  <div className="bg-background text-text min-h-screen p-6">
    {location.pathname.includes("overlay") ? (
      <SynapseLiveOverlay api={api} />
    ) : (
      <>
        <SynapseWorkspace settingsOnly api={api} />
        <SynapseWorkspace api={api} />
      </>
    )}
  </div>,
);
