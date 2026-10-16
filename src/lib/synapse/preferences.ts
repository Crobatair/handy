import { create } from "zustand";
export type WorkspacePreferences = {
  committed: string;
  tentative: string;
  output: string;
  provider: string;
  key: string;
  language: string;
  modeId: string;
  customInstructions: string;
  modeOverrides: Record<string, string>;
  context: string;
  dictionary: string;
  rules: string;
  autoCorrect: boolean;
  guidanceEnabled: boolean;
  guidanceInterval: number;
};
if (!localStorage.getItem("synapse.sessionPauseFix")) {
  localStorage.setItem("synapse.guidance", "true");
  localStorage.setItem("synapse.sessionPauseFix", "1");
}
function savedOverrides(): Record<string, string> {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem("synapse.modeOverrides") || "{}",
    );
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return Object.fromEntries(
        Object.entries(value).filter(
          ([, instruction]) => typeof instruction === "string",
        ),
      );
    }
  } catch {
    /* Fall back to the built-in instructions. */
  }
  return {};
}
export const useWorkspacePreferences = create<
  WorkspacePreferences & {
    update: (value: Partial<WorkspacePreferences>) => void;
  }
>((set) => ({
  committed: "",
  tentative: "",
  output: "",
  provider: "local",
  key: "",
  language: "en",
  modeId: localStorage.getItem("synapse.modeId") || "prompt",
  customInstructions: localStorage.getItem("synapse.customInstructions") || "",
  modeOverrides: savedOverrides(),
  context: "",
  dictionary: "",
  rules: "",
  autoCorrect: true,
  guidanceInterval: [5, 10, 15, 30, 60].includes(
    Number(localStorage.getItem("synapse.guidanceInterval")),
  )
    ? Number(localStorage.getItem("synapse.guidanceInterval"))
    : 30,
  guidanceEnabled: localStorage.getItem("synapse.guidance") !== "false",
  update: (value) => {
    try {
      if (value.guidanceInterval !== undefined)
        localStorage.setItem(
          "synapse.guidanceInterval",
          String(value.guidanceInterval),
        );
      if (value.guidanceEnabled !== undefined)
        localStorage.setItem("synapse.guidance", String(value.guidanceEnabled));
      if (value.modeId !== undefined)
        localStorage.setItem("synapse.modeId", value.modeId);
      if (value.customInstructions !== undefined)
        localStorage.setItem(
          "synapse.customInstructions",
          value.customInstructions,
        );
      if (value.modeOverrides !== undefined)
        localStorage.setItem(
          "synapse.modeOverrides",
          JSON.stringify(value.modeOverrides),
        );
    } catch {
      /* Keep the current session editable when storage is unavailable. */
    }
    set(value);
  },
}));

window.addEventListener("storage", (event) => {
  if (event.key === "synapse.modeId" && event.newValue)
    useWorkspacePreferences.setState({ modeId: event.newValue });
  if (event.key === "synapse.guidance")
    useWorkspacePreferences.setState({
      guidanceEnabled: event.newValue !== "false",
    });
});
