import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
export type Guidance = {
  outline?: string[];
  next_steps?: string[];
  good_practices: string[];
  missing: string[];
  deep_dive: string[];
};
export type Transcript = {
  session_id?: string;
  phase?: string;
  output?: string;
  mode?: Mode;
  available_modes?: Mode[];
  guidance_enabled?: boolean;
  guidance_interval_seconds?: number;
  error?: string;
  canceled?: boolean;
  committed: string;
  tentative: string;
};
export type Mode = {
  id: string;
  label: string;
  description: string;
  instructions: string;
};
export type WorkspaceConfig = {
  provider: string;
  deepgram_key: string;
  language: string;
  mode_instructions: string;
  mode_id?: string;
  available_modes?: Mode[];
  auto_correct: boolean;
  mode_label: string;
  mode_description: string;
  guidance_enabled: boolean;
  guidance_interval_seconds?: number;
};
export interface WorkspaceApi {
  selectMode?(id: string): Promise<void>;
  setInterval?(seconds: number): Promise<void>;
  setGuidance?(enabled: boolean): Promise<void>;
  preview(): Promise<void>;
  dismiss(): Promise<void>;
  configure(config: WorkspaceConfig | null): Promise<void>;
  start(args: {
    sessionId: string;
    provider: string;
    deepgramKey: string;
    language: string;
  }): Promise<void>;
  stopShortcut(sessionId: string): Promise<void>;
  copy(text: string): Promise<void>;
  stop(sessionId: string): Promise<string>;
  cancel(sessionId: string): Promise<void>;
  guidance(transcript: string, mode: Mode): Promise<Guidance>;
  rewrite(transcript: string, instructions: string): Promise<string>;
  subscribe(callback: (event: Transcript) => void): Promise<UnlistenFn>;
}
export const workspaceApi: WorkspaceApi = {
  selectMode: (id) => invoke("synapse_select_mode", { id }),
  setInterval: (seconds) => invoke("synapse_set_interval", { seconds }),
  setGuidance: (enabled) => invoke("synapse_set_guidance", { enabled }),
  preview: () => invoke("synapse_preview_overlay"),
  dismiss: () => invoke("synapse_dismiss_overlay"),
  stopShortcut: (sessionId) => invoke("synapse_shortcut_stop", { sessionId }),
  configure: (config) => invoke("synapse_configure", { config }),
  start: (args) => invoke("synapse_start", args),
  copy: (text) => invoke("synapse_copy", { text }),
  stop: (sessionId) => invoke("synapse_stop", { sessionId }),
  cancel: (sessionId) => invoke("synapse_cancel", { sessionId }),
  guidance: (transcript, mode) =>
    invoke("synapse_guidance", {
      transcript,
      modeLabel: mode.label,
      modeDescription: mode.description,
      modeInstructions: mode.instructions,
    }),
  rewrite: (transcript, modeInstructions) =>
    invoke("synapse_rewrite", { transcript, modeInstructions }),
  subscribe: async (callback) => {
    const subscriptions: UnlistenFn[] = [];
    try {
      subscriptions.push(
        await listen<Transcript>("synapse-transcript", (event) =>
          callback(event.payload),
        ),
      );

      subscriptions.push(
        await listen<Transcript>("synapse-session", (event) =>
          callback(event.payload),
        ),
      );
      subscriptions.push(
        await listen("hide-overlay", () =>
          callback({ phase: "hidden", committed: "", tentative: "" }),
        ),
      );
      return () => subscriptions.forEach((unlisten) => unlisten());
    } catch (error) {
      subscriptions.forEach((unlisten) => unlisten());
      throw error;
    }
  },
};
