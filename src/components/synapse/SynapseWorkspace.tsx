import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Mic,
  Square,
  Sparkles,
  Copy,
  X,
  Radio,
  ShieldCheck,
} from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { PostProcessingSettingsApi } from "@/components/settings/post-processing/PostProcessingSettings";
import { useWorkspacePreferences } from "@/lib/synapse/preferences";
import { spokenWords } from "@/lib/synapse/guidance";
import { FeedbackInterval } from "./FeedbackInterval";
import modes from "@/lib/synapse/modes.json";
import {
  workspaceApi,
  type WorkspaceApi,
  type Guidance,
  type Mode,
} from "@/lib/synapse/api";

type Phase = "idle" | "starting" | "recording" | "stopping" | "rewriting";
const fieldClass =
  "w-full rounded-lg border border-mid-gray/25 bg-background px-3 py-2 text-sm focus:outline-none focus:border-logo-primary";
const buttonClass =
  "flex items-center justify-center gap-2 rounded-lg border border-mid-gray/25 px-3 py-2 text-sm hover:bg-mid-gray/10 disabled:opacity-40 disabled:cursor-not-allowed";

export default function SynapseWorkspace({
  api = workspaceApi,
  settingsOnly = false,
}: {
  api?: WorkspaceApi;
  settingsOnly?: boolean;
}) {
  const { t } = useTranslation();
  const preferences = useWorkspacePreferences();
  const { settings } = useSettings();
  const provider = preferences.provider;
  const setProvider = (provider: string) => preferences.update({ provider });
  const key = preferences.key;
  const setKey = (key: string) => preferences.update({ key });
  const language = preferences.language;
  const setLanguage = (language: string) => preferences.update({ language });
  const modeId = preferences.modeId;
  const setModeId = (modeId: string) => preferences.update({ modeId });
  const customInstructions = preferences.customInstructions;
  const setCustomInstructions = (customInstructions: string) =>
    preferences.update({ customInstructions });
  const context = preferences.context;
  const setContext = (context: string) => preferences.update({ context });
  const dictionary = preferences.dictionary;
  const setDictionary = (dictionary: string) =>
    preferences.update({ dictionary });
  const rules = preferences.rules;
  const setRules = (rules: string) => preferences.update({ rules });
  const [phase, setPhase] = useState<Phase>("idle");
  const committed = preferences.committed;
  const setCommitted = (committed: string) => preferences.update({ committed });
  const tentative = preferences.tentative;
  const setTentative = (tentative: string) => preferences.update({ tentative });
  const output = preferences.output;
  const setOutput = (output: string) => preferences.update({ output });
  const autoCorrect = preferences.autoCorrect;
  const setAutoCorrect = (autoCorrect: boolean) =>
    preferences.update({ autoCorrect });
  const guidanceEnabled = preferences.guidanceEnabled;
  const guidanceInterval = preferences.guidanceInterval;
  const setGuidanceEnabled = (guidanceEnabled: boolean) =>
    preferences.update({ guidanceEnabled });
  const [sessionPaused, setSessionPaused] = useState(false);
  const [guidance, setGuidance] = useState<Guidance | null>(null);
  const [guidanceBusy, setGuidanceBusy] = useState(false);
  const [guidanceError, setGuidanceError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [listeningReady, setListeningReady] = useState(false);
  const session = useRef<string | null>(null);
  const revision = useRef(0);
  const mounted = useRef(true);
  const requestBusy = useRef(false);
  const lastAnalyzed = useRef("");
  const lastRequested = useRef(0);
  const text = [committed, tentative].filter(Boolean).join(" ");
  const active = phase !== "idle";
  const builtin = modes.find((mode) => mode.id === modeId) ?? modes[0];
  const hintValues = {
    context_hint: context ? `About the speaker: ${context}` : "",
    dict_hint: dictionary ? `Preserve these terms exactly: ${dictionary}` : "",
    rules_hint: rules ? `Custom correction rules: ${rules}` : "",
  };
  const instructionTemplate =
    modeId === "custom"
      ? customInstructions
      : (preferences.modeOverrides[builtin.id] ?? builtin.instructions);
  let renderedInstructions = instructionTemplate;
  for (const [name, value] of Object.entries(hintValues)) {
    const marker = `{{${name}}}`;
    renderedInstructions = renderedInstructions.includes(marker)
      ? renderedInstructions.split(marker).join(value ? `\n\n${value}\n\n` : "")
      : `${renderedInstructions}\n\n${value}`;
  }
  const mode: Mode =
    modeId === "custom"
      ? {
          id: "custom",
          label: t("synapse.custom"),
          description: t("synapse.customDescription"),
          instructions: renderedInstructions,
        }
      : {
          ...builtin,
          label: t(`synapse.modes.${builtin.id}.label`),
          description: t(`synapse.modes.${builtin.id}.description`),
          instructions: renderedInstructions,
        };
  const availableModes: Mode[] = [
    ...modes,
    {
      id: "custom",
      label: t("synapse.custom"),
      description: t("synapse.customDescription"),
      instructions: customInstructions,
    },
  ].map((item) => {
    let instructions = preferences.modeOverrides[item.id] ?? item.instructions;
    for (const [name, value] of Object.entries(hintValues)) {
      const marker = `{{${name}}}`;
      instructions = instructions.includes(marker)
        ? instructions.split(marker).join(value ? `\n\n${value}\n\n` : "")
        : `${instructions}\n\n${value}`;
    }
    return {
      ...item,
      label:
        item.id === "custom"
          ? t("synapse.custom")
          : t(`synapse.modes.${item.id}.label`),
      description:
        item.id === "custom"
          ? t("synapse.customDescription")
          : t(`synapse.modes.${item.id}.description`),
      instructions,
    };
  });
  const latest = useRef({
    text,
    phase,
    mode,
    guidanceEnabled,
    guidanceInterval,
  });
  latest.current = {
    text,
    phase,
    mode,
    guidanceInterval,
    guidanceEnabled: guidanceEnabled && !sessionPaused,
  };

  useEffect(() => {
    void api
      .configure({
        provider,
        deepgram_key: key,
        language,
        mode_instructions: mode.instructions,
        mode_id: mode.id,
        available_modes: availableModes,
        auto_correct: autoCorrect,
        mode_label: mode.label,
        mode_description: mode.description,
        guidance_enabled: guidanceEnabled,
        guidance_interval_seconds: guidanceInterval,
      })
      .catch((reason) => setError(String(reason)));
  }, [
    api,
    provider,
    key,
    language,
    mode.instructions,
    mode.label,
    mode.description,
    autoCorrect,
    guidanceEnabled,
    guidanceInterval,
    customInstructions,
    preferences.modeOverrides,
  ]);

  useEffect(() => {
    mounted.current = true;
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    api
      .subscribe((event) => {
        if (event.phase === "mode" && event.mode) {
          useWorkspacePreferences.getState().update({ modeId: event.mode.id });
          revision.current++;
          setGuidance(null);
          setGuidanceBusy(false);
          return;
        }
        if (event.phase === "interval" && event.guidance_interval_seconds) {
          useWorkspacePreferences
            .getState()
            .update({ guidanceInterval: event.guidance_interval_seconds });
          return;
        }
        if (event.phase === "guidance") {
          setSessionPaused(!(event.guidance_enabled ?? true));
          revision.current++;
          setGuidance(null);
          setGuidanceBusy(false);
          return;
        }
        if (event.phase) {
          if (event.phase === "recording" && event.session_id) {
            setSessionPaused(false);
            lastRequested.current = Date.now();
            session.current = event.session_id;
            revision.current++;
            lastAnalyzed.current = "";
            setCommitted("");
            setTentative("");
            setOutput("");
            setError("");
            setNotice("");
            setGuidance(null);
            setPhase("recording");
          } else if (
            event.session_id === session.current ||
            event.phase === "failed"
          ) {
            if (event.phase === "stopping") {
              revision.current++;
              setGuidanceBusy(false);
              setPhase("stopping");
            }
            if (event.phase === "finished") {
              setCommitted(event.committed);
              setTentative("");
              setOutput(event.output ?? "");
              setNotice(t("synapse.correctedCopied"));
              session.current = null;
              setPhase("idle");
            }
            if (event.error) setError(event.error);
            if (event.phase === "failed") {
              session.current = null;
              setPhase("idle");
            }
          }
          return;
        }
        if (
          !session.current ||
          !["starting", "recording", "stopping"].includes(latest.current.phase)
        )
          return;
        if (event.session_id && event.session_id !== session.current) return;
        if (event.error || event.canceled) {
          const id = session.current;
          revision.current++;
          setGuidanceBusy(false);
          if (event.error) setError(event.error);
          session.current = null;
          setPhase("stopping");
          void api
            .cancel(id)
            .catch((reason) => {
              if (mounted.current) setError(String(reason));
            })
            .finally(() => {
              if (mounted.current && !session.current) setPhase("idle");
            });
          return;
        }
        setCommitted(event.committed);
        setTentative(event.tentative);
      })
      .then((cleanup) => {
        if (disposed) cleanup();
        else {
          unsubscribe = cleanup;
          setListeningReady(true);
        }
      })
      .catch((reason) => {
        if (!disposed) setError(String(reason));
      });
    return () => {
      disposed = true;
      mounted.current = false;
      revision.current++;
      unsubscribe?.();

      const id = session.current;
      if (id && !id.startsWith("shortcut-"))
        void api.cancel(id).catch(() => {});
    };
  }, [api]);

  useEffect(() => {
    localStorage.setItem("synapse.guidance", String(guidanceEnabled));
    revision.current++;
    setGuidance(null);
    setGuidanceError("");
    setGuidanceBusy(false);
  }, [
    modeId,
    customInstructions,
    mode.instructions,
    context,
    dictionary,
    rules,
    guidanceEnabled,
    settings?.post_process_provider_id,
    settings?.post_process_models,
  ]);

  useEffect(() => {
    const update = async () => {
      const snapshot = latest.current;
      if (
        settingsOnly ||
        !snapshot.guidanceEnabled ||
        session.current?.startsWith("shortcut-") ||
        snapshot.phase !== "recording" ||
        requestBusy.current ||
        snapshot.text.trim().length < 20 ||
        spokenWords(snapshot.text) === lastAnalyzed.current ||
        Date.now() - lastRequested.current < snapshot.guidanceInterval * 1000
      )
        return;
      const currentRevision = revision.current;
      const currentSession = session.current;
      lastAnalyzed.current = spokenWords(snapshot.text);
      lastRequested.current = Date.now();
      requestBusy.current = true;
      setGuidanceBusy(true);
      try {
        const result = await api.guidance(snapshot.text, snapshot.mode);
        if (
          mounted.current &&
          currentRevision === revision.current &&
          currentSession === session.current
        ) {
          setGuidance(result);
          setGuidanceError("");
        }
      } catch (reason) {
        if (
          currentRevision === revision.current &&
          currentSession === session.current &&
          /Authentication failed|API key/i.test(String(reason))
        )
          setSessionPaused(true);
        if (
          mounted.current &&
          currentRevision === revision.current &&
          currentSession === session.current
        )
          setGuidanceError(String(reason));
      } finally {
        requestBusy.current = false;
        if (mounted.current && currentRevision === revision.current)
          setGuidanceBusy(false);
      }
    };
    const timer = window.setInterval(() => void update(), 1000);
    return () => window.clearInterval(timer);
  }, [api, settingsOnly]);

  const start = async () => {
    lastAnalyzed.current = "";
    lastRequested.current = Date.now();
    setSessionPaused(false);
    setError("");
    setNotice("");
    setOutput("");
    setCommitted("");
    setTentative("");
    setGuidance(null);
    setGuidanceError("");
    revision.current++;
    const id = crypto.randomUUID();
    session.current = id;
    setPhase("starting");
    try {
      await api.start({ sessionId: id, provider, deepgramKey: key, language });
      if (!mounted.current || session.current !== id) {
        await api.cancel(id);
        return;
      }
      setPhase("recording");
    } catch (reason) {
      if (mounted.current) {
        setError(String(reason));
        session.current = null;
        setPhase("idle");
      }
    }
  };
  const stop = async () => {
    const id = session.current;
    if (!id) return;
    revision.current++;
    setGuidanceBusy(false);
    setPhase("stopping");
    if (id.startsWith("shortcut-")) {
      try {
        await api.stopShortcut(id);
      } catch (reason) {
        setError(String(reason));
        setPhase("recording");
      }
      return;
    }
    try {
      const result = await api.stop(id);
      if (!mounted.current) return;
      setCommitted(result);
      setTentative("");
      session.current = null;
      if (!result.trim()) return;
      let finalText = result;
      let correctionError = "";
      if (
        autoCorrect &&
        settings?.post_process_models?.[
          settings.post_process_provider_id ?? ""
        ]?.trim()
      ) {
        setPhase("rewriting");
        try {
          finalText = await api.rewrite(result, mode.instructions);
          if (mounted.current) setOutput(finalText);
        } catch (reason) {
          correctionError = String(reason);
        }
      }
      await api.copy(finalText);
      if (mounted.current) {
        setNotice(
          t(
            finalText === result
              ? "synapse.rawCopied"
              : "synapse.correctedCopied",
          ),
        );
        if (correctionError) setError(correctionError);
      }
    } catch (reason) {
      if (mounted.current) setError(String(reason));
    } finally {
      session.current = null;
      if (mounted.current) setPhase("idle");
    }
  };
  const cancel = async () => {
    const id = session.current;
    if (!id) return;
    revision.current++;
    setGuidanceBusy(false);
    setPhase("stopping");
    try {
      await api.cancel(id);
      if (mounted.current) {
        setCommitted("");
        setTentative("");
        setGuidance(null);
      }
    } catch (reason) {
      if (mounted.current) setError(String(reason));
    } finally {
      session.current = null;
      if (mounted.current) setPhase("idle");
    }
  };
  const rewrite = async () => {
    setPhase("rewriting");
    setError("");
    setNotice("");
    try {
      const result = await api.rewrite(text, mode.instructions);
      if (mounted.current) setOutput(result);
      await api.copy(result);
      if (mounted.current) setNotice(t("synapse.correctedCopied"));
    } catch (reason) {
      if (mounted.current) setError(String(reason));
    } finally {
      if (mounted.current) setPhase("idle");
    }
  };
  const copy = async (value: string) => {
    try {
      await api.copy(value);
      setNotice(t("synapse.copied"));
    } catch {
      setError(t("synapse.copyError"));
    }
  };
  const aiProvider = settings?.post_process_providers?.find(
    (item) => item.id === settings.post_process_provider_id,
  );
  const aiModel =
    settings?.post_process_models?.[settings.post_process_provider_id ?? ""];

  const missingSetup = [
    provider === "deepgram" && !key.trim() ? t("synapse.needSpeechKey") : "",
    provider === "local" && !settings?.selected_model
      ? t("synapse.needSpeechModel")
      : "",
    (guidanceEnabled || autoCorrect) && !aiModel?.trim()
      ? t("synapse.needAiModel")
      : "",
    (guidanceEnabled || autoCorrect) &&
    aiProvider?.id !== "custom" &&
    [
      "anthropic",
      "openai",
      "openrouter",
      "groq",
      "cerebras",
      "gemini",
    ].includes(aiProvider?.id ?? "") &&
    !settings?.post_process_api_keys?.[aiProvider?.id ?? ""]?.trim()
      ? t("synapse.needAiKey")
      : "",
    !instructionTemplate.trim() ? t("synapse.needInstructions") : "",
  ].filter(Boolean);
  const setupNotice = missingSetup.length ? (
    <div
      role="status"
      className="rounded-lg border border-amber-500/30 p-3 text-sm"
    >
      <strong>{t("synapse.setupMissing")}</strong>
      <ul className="list-disc ps-5">
        {missingSetup.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  ) : null;

  if (settingsOnly)
    return (
      <section className="w-full max-w-4xl space-y-5">
        <header>
          <h1 className="text-2xl font-semibold">
            {t("synapse.settingsTitle")}
          </h1>
          <p className="mt-1 text-sm text-mid-gray">
            {t("synapse.settingsSubtitle")}
          </p>
        </header>{" "}
        {setupNotice}
        <div className="grid gap-4 rounded-xl border border-mid-gray/20 bg-background-ui/20 p-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span>{t("synapse.transcriptionProvider")}</span>
            <select
              className={fieldClass}
              value={provider}
              disabled={active}
              onChange={(e) => setProvider(e.target.value)}
            >
              <option value="local">{t("synapse.local")}</option>
              <option value="deepgram">{t("synapse.deepgram")}</option>
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span>{t("synapse.mode")}</span>
            <select
              className={fieldClass}
              value={modeId}
              disabled={phase === "rewriting"}
              onChange={(e) => setModeId(e.target.value)}
            >
              {modes.map((item) => (
                <option key={item.id} value={item.id}>
                  {t(`synapse.modes.${item.id}.label`)}
                </option>
              ))}
              <option value="custom">{t("synapse.custom")}</option>
            </select>
          </label>
          {provider === "deepgram" ? (
            <>
              <label className="space-y-2 text-sm">
                <span>{t("synapse.deepgramKey")}</span>
                <input
                  className={fieldClass}
                  type="password"
                  aria-label={t("synapse.deepgramKey")}
                  autoComplete="off"
                  value={key}
                  disabled={active}
                  onChange={(e) => setKey(e.target.value)}
                />
                <span className="block text-xs text-mid-gray">
                  {t("synapse.keyHint")}
                </span>
              </label>
              <label className="space-y-2 text-sm">
                <span>{t("synapse.language")}</span>
                <select
                  className={fieldClass}
                  value={language}
                  disabled={active}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  <option value="en">{t("synapse.english")}</option>
                  <option value="es">{t("synapse.spanish")}</option>
                  <option value="multi">{t("synapse.multilingual")}</option>
                </select>
              </label>
            </>
          ) : (
            <p className="text-xs text-mid-gray sm:col-span-2">
              {t("synapse.localHint", {
                model: settings?.selected_model || t("synapse.noModel"),
              })}
            </p>
          )}
          {
            <label className="space-y-2 text-sm sm:col-span-2">
              <span>{t("synapse.instructions")}</span>
              <textarea
                rows={12}
                className={`${fieldClass} min-h-64 resize-y leading-6`}
                value={instructionTemplate}
                disabled={phase === "rewriting"}
                onChange={(e) => {
                  if (modeId === "custom")
                    setCustomInstructions(e.target.value);
                  else
                    preferences.update({
                      modeOverrides: {
                        ...preferences.modeOverrides,
                        [builtin.id]: e.target.value,
                      },
                    });
                }}
              />
              <span className="block text-xs text-mid-gray">
                {t("synapse.instructionsHint")}
              </span>
              {modeId !== "custom" &&
                preferences.modeOverrides[builtin.id] !== undefined && (
                  <button
                    type="button"
                    disabled={phase === "rewriting"}
                    onClick={() => {
                      const overrides = { ...preferences.modeOverrides };
                      delete overrides[builtin.id];
                      preferences.update({ modeOverrides: overrides });
                    }}
                  >
                    {t("synapse.resetInstructions")}
                  </button>
                )}
            </label>
          }
          <details className="sm:col-span-2">
            <summary className="cursor-pointer text-sm text-mid-gray">
              {t("synapse.contextTitle")}
            </summary>
            <div className="mt-3 grid gap-3">
              <label className="space-y-1 text-sm">
                <span>{t("synapse.context")}</span>
                <textarea
                  className={fieldClass}
                  rows={2}
                  value={context}
                  disabled={phase === "rewriting"}
                  onChange={(e) => setContext(e.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span>{t("synapse.dictionary")}</span>
                <input
                  className={fieldClass}
                  value={dictionary}
                  disabled={phase === "rewriting"}
                  onChange={(e) => setDictionary(e.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span>{t("synapse.rules")}</span>
                <textarea
                  className={fieldClass}
                  rows={2}
                  value={rules}
                  disabled={phase === "rewriting"}
                  onChange={(e) => setRules(e.target.value)}
                />
              </label>
            </div>
          </details>
        </div>
        <div className="flex flex-wrap gap-4">
          {" "}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoCorrect}
              disabled={active}
              onChange={(event) => setAutoCorrect(event.target.checked)}
            />
            {t("synapse.autoCorrect")}
          </label>{" "}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={guidanceEnabled}
              onChange={(e) => setGuidanceEnabled(e.target.checked)}
            />
            {t("synapse.liveGuidance")}
          </label>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm">
          <span>{t("synapse.interval")}</span>
          <FeedbackInterval
            value={guidanceInterval}
            onChange={(seconds) =>
              preferences.update({ guidanceInterval: seconds })
            }
          />
        </div>
        <button
          className={buttonClass}
          disabled={active}
          onClick={() =>
            void api.preview().catch((reason) => setError(String(reason)))
          }
        >
          {t("synapse.previewOverlay")}
        </button>
        <p className="text-xs text-mid-gray">
          {t("synapse.aiRoute", {
            provider: aiProvider?.label || t("synapse.noProvider"),
            model: aiModel || t("synapse.noModel"),
          })}{" "}
          {t("synapse.aiHint")}
        </p>
        <details
          className="rounded-xl border border-mid-gray/20 p-4"
          open={!aiModel}
        >
          <summary className="cursor-pointer text-sm font-medium">
            {t("synapse.aiSetup")}
          </summary>
          <p className="my-3 text-xs text-mid-gray">
            {t("synapse.aiExplanation")}
          </p>
          <PostProcessingSettingsApi />
        </details>
        {error && (
          <p role="alert" className="text-red-400 text-sm">
            {error}
          </p>
        )}
      </section>
    );

  return (
    <section className="w-full space-y-3 pb-3">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            {t("synapse.title")}
          </h1>
        </div>
        <span className="rounded-full border border-logo-primary/30 bg-logo-primary/10 px-3 py-1 text-xs">
          {t("synapse.prototype")}
        </span>
      </header>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-mid-gray">
          {mode.label} ·{" "}
          {t(provider === "deepgram" ? "synapse.deepgram" : "synapse.local")}
        </p>
        <button
          className={buttonClass}
          disabled={active}
          onClick={() =>
            window.dispatchEvent(new Event("synapse-open-settings"))
          }
        >
          {t("synapse.settingsTitle")}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {phase === "recording" ? (
          <>
            <button
              className={`${buttonClass} bg-logo-primary/80`}
              onClick={() => void stop()}
            >
              <Square size={16} />
              {t("synapse.stop")}
            </button>
            <button className={buttonClass} onClick={() => void cancel()}>
              <X size={16} />
              {t("synapse.cancel")}
            </button>
          </>
        ) : (
          <button
            className={`${buttonClass} bg-logo-primary/80`}
            disabled={
              active ||
              !listeningReady ||
              (provider === "deepgram" && !key.trim())
            }
            onClick={() => void start()}
          >
            <Mic size={16} />
            {t(active ? `synapse.phases.${phase}` : "synapse.start")}
          </button>
        )}

        {phase === "recording" && guidanceEnabled && (
          <button
            className={buttonClass}
            onClick={() => {
              const enabled = sessionPaused;
              setSessionPaused(!sessionPaused);
              revision.current++;
              setGuidance(null);
              setGuidanceBusy(false);
              void api
                .setGuidance?.(enabled)
                .catch((reason) => setError(String(reason)));
            }}
          >
            {t(
              sessionPaused
                ? "synapse.resumeGuidance"
                : "synapse.pauseGuidance",
            )}
          </button>
        )}
        <span className="ms-auto flex items-center gap-1.5 text-xs text-mid-gray">
          {provider === "local" ? (
            <ShieldCheck size={14} />
          ) : (
            <Radio size={14} />
          )}
          {t(
            provider === "local" ? "synapse.localAudio" : "synapse.cloudAudio",
          )}
        </span>
      </div>

      {setupNotice}
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-logo-primary">
          {notice}
        </p>
      )}
      <div
        className={`grid gap-4 ${guidanceEnabled ? "lg:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)]" : ""}`}
      >
        <div className="rounded-xl border border-mid-gray/20 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-medium">{t("synapse.transcript")}</h2>
            <span className="text-xs text-mid-gray" role="status">
              {t(`synapse.phases.${phase}`)}
            </span>
          </div>
          <div
            aria-live="polite"
            className="min-h-48 whitespace-pre-wrap select-text text-sm leading-7"
          >
            <span>{committed}</span>
            {committed && tentative && " "}
            <span className="text-mid-gray">{tentative}</span>
            {!text && (
              <p className="text-mid-gray">{t("synapse.transcriptHint")}</p>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              className={buttonClass}
              disabled={!text || active}
              onClick={() => void copy(text)}
            >
              <Copy size={14} />
              {t("synapse.copyTranscript")}
            </button>
            <button
              className={buttonClass}
              disabled={
                !text ||
                active ||
                (modeId === "custom" && !customInstructions.trim())
              }
              onClick={() => void rewrite()}
            >
              <Sparkles size={14} />
              {t("synapse.rewrite")}
            </button>
          </div>
        </div>
        {guidanceEnabled && !sessionPaused && (
          <aside className="rounded-xl border border-mid-gray/20 bg-background-ui/20 p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">{t("synapse.liveGuidance")}</h2>
              {guidanceBusy && (
                <span role="status" className="text-xs text-mid-gray">
                  {t("synapse.updating")}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-mid-gray">{mode.label}</p>
            {(
              [
                "outline",
                "next_steps",
                "missing",
                "deep_dive",
                "good_practices",
              ] as const
            ).map((category) =>
              guidance?.[category]?.length ? (
                <div key={category} className="mt-4">
                  <h3 className="text-sm font-medium">
                    {t(`synapse.guidance.${category}`)}
                  </h3>
                  <ol className="mt-2 list-decimal space-y-2 ps-4 text-sm text-mid-gray">
                    {guidance[category]!.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ol>
                </div>
              ) : null,
            )}
            {!guidance && (
              <p className="mt-5 text-sm text-mid-gray">
                {t("synapse.guidanceHint", { seconds: guidanceInterval })}
              </p>
            )}
            {guidance &&
              !Object.values(guidance).some((items) => items?.length) && (
                <p className="mt-5 text-sm text-mid-gray">
                  {t("synapse.noGuidance")}
                </p>
              )}
            {guidanceError && (
              <p role="alert" className="mt-4 text-sm text-red-400">
                {guidanceError}
              </p>
            )}
          </aside>
        )}
      </div>
      {output && (
        <div className="rounded-xl border border-logo-primary/30 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">{t("synapse.finalOutput")}</h2>
            <button className={buttonClass} onClick={() => void copy(output)}>
              <Copy size={14} />
              {t("synapse.copy")}
            </button>
          </div>
          <p className="mt-4 whitespace-pre-wrap select-text text-sm leading-7">
            {output}
          </p>
        </div>
      )}
    </section>
  );
}
