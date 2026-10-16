import { GuidanceCards } from "@/components/synapse/GuidanceCards";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  workspaceApi,
  type WorkspaceApi,
  type Mode,
  type Guidance,
} from "@/lib/synapse/api";
import { FeedbackInterval } from "@/components/synapse/FeedbackInterval";
import { spokenWords } from "@/lib/synapse/guidance";
import "./SynapseLiveOverlay.css";

export default function SynapseLiveOverlay({
  api = workspaceApi,
}: {
  api?: WorkspaceApi;
}) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState("preview");
  const [mode, setMode] = useState<Mode | null>(null);
  const [availableModes, setAvailableModes] = useState<Mode[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [interval, setIntervalSeconds] = useState(30);
  const [text, setText] = useState("");
  const [guidance, setGuidance] = useState<Guidance | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [guidanceError, setGuidanceError] = useState("");
  const [output, setOutput] = useState("");
  const current = useRef({
    id: "",
    phase,
    mode,
    enabled,
    text,
    interval,
    revision: 0,
  });
  Object.assign(current.current, { phase, mode, enabled, text, interval });
  const paused = useRef(false);
  const inFlight = useRef(false);
  const lastAnalyzed = useRef("");
  const lastRequested = useRef(0);
  const mounted = useRef(true);
  const scroll = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mounted.current = true;
    let disposed = false;
    const cleanup: (() => void)[] = [];
    const setup = async () => {
      const unsubscribe = await api.subscribe((event) => {
        if (event.available_modes) setAvailableModes(event.available_modes);
        if (event.phase === "mode" && event.mode) {
          localStorage.setItem("synapse.modeId", event.mode.id);
          setMode(event.mode);
          current.current.mode = event.mode;
          current.current.revision++;
          setGuidance(null);
          setGuidanceError("");
          setBusy(false);
          return;
        }
        if (event.guidance_interval_seconds) {
          setIntervalSeconds(event.guidance_interval_seconds);
          current.current.interval = event.guidance_interval_seconds;
        }
        if (event.phase === "interval") return;
        if (
          (event.phase === "guidance" || event.phase === "configuration") &&
          current.current.id.startsWith("shortcut-plain_dictation-") &&
          current.current.phase === "recording"
        )
          return;
        if (event.phase === "guidance") {
          paused.current = !(event.guidance_enabled ?? true);
          setEnabled(event.guidance_enabled ?? true);
          current.current.enabled = event.guidance_enabled ?? true;
          current.current.revision++;
          setGuidance(null);
          setGuidanceError("");
          setBusy(false);
          return;
        }
        if (event.phase === "hidden") {
          setVisible(false);
          current.current.revision++;
          return;
        }
        if (event.phase === "configuration") {
          if (event.mode) setMode(event.mode);
          setEnabled((event.guidance_enabled ?? true) && !paused.current);
          current.current.revision++;
          setGuidance(null);
          setGuidanceError("");
          setBusy(false);
          return;
        }
        if (event.phase === "recording" || event.phase === "preview") {
          lastAnalyzed.current = "";
          paused.current = false;
          current.current.id = event.session_id ?? "";
          current.current.revision++;
          lastRequested.current = Date.now();
          setVisible(
            !current.current.id.startsWith("shortcut-plain_dictation-"),
          );
          setPhase(event.phase);
          setText("");
          setOutput("");
          setError("");
          setGuidance(null);
          setGuidanceError("");
          setBusy(false);
          if (event.mode) setMode(event.mode);
          setEnabled(event.guidance_enabled ?? true);
          return;
        }
        if (!event.session_id || event.session_id !== current.current.id)
          return;
        if (event.phase) {
          current.current.revision++;
          setPhase(event.phase);
          setBusy(false);
          if (event.phase === "finished") {
            setText(event.committed);
            setOutput(event.output ?? "");
          }
          if (event.error) setError(event.error);
          return;
        }
        if (event.canceled) {
          setVisible(false);
          current.current.revision++;
          return;
        }
        if (event.error) {
          setError(event.error);
          setPhase("failed");
          current.current.revision++;
          return;
        }
        setText([event.committed, event.tentative].filter(Boolean).join(" "));
      });
      if (disposed) unsubscribe();
      else cleanup.push(unsubscribe);
    };
    void setup().catch((reason) => {
      if (!disposed) setError(String(reason));
    });
    const timer = setInterval(async () => {
      const snapshot = { ...current.current };
      if (
        !snapshot.enabled ||
        snapshot.phase !== "recording" ||
        !snapshot.mode ||
        snapshot.text.trim().length < 20 ||
        inFlight.current ||
        spokenWords(snapshot.text) === lastAnalyzed.current ||
        Date.now() - lastRequested.current < snapshot.interval * 1000
      )
        return;
      inFlight.current = true;
      lastRequested.current = Date.now();
      lastAnalyzed.current = spokenWords(snapshot.text);
      setBusy(true);
      try {
        const result = await api.guidance(snapshot.text, snapshot.mode);
        if (
          mounted.current &&
          current.current.id === snapshot.id &&
          current.current.revision === snapshot.revision &&
          current.current.phase === "recording"
        ) {
          setGuidance(result);
          setGuidanceError("");
        }
      } catch (reason) {
        if (
          current.current.id === snapshot.id &&
          current.current.revision === snapshot.revision &&
          /Authentication failed|API key/i.test(String(reason))
        ) {
          paused.current = true;
          current.current.enabled = false;
          setEnabled(false);
        }
        if (
          mounted.current &&
          current.current.id === snapshot.id &&
          current.current.revision === snapshot.revision
        )
          setGuidanceError(String(reason));
      } finally {
        inFlight.current = false;
        if (mounted.current && current.current.revision === snapshot.revision)
          setBusy(false);
      }
    }, 1000);
    return () => {
      disposed = true;
      mounted.current = false;
      current.current.revision++;
      clearInterval(timer);
      cleanup.forEach((fn) => fn());
    };
  }, [api]);
  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [text, output]);
  if (!visible) return null;
  const recording = phase === "recording";
  const stop = () =>
    api
      .stopShortcut(current.current.id)
      .catch((reason) => setError(String(reason)));
  const cancel = () =>
    api.cancel(current.current.id).catch((reason) => setError(String(reason)));
  const close = () => {
    setVisible(false);
    void api.dismiss().catch((reason) => setError(String(reason)));
  };
  return (
    <section className="synapse-float" aria-label={t("synapse.floatingTitle")}>
      <header>
        <div>
          <label>
            <span className="sf-mode-label">{t("synapse.mode")}</span>
            <select
              aria-label={t("synapse.mode")}
              value={
                availableModes.some((item) => item.id === mode?.id)
                  ? mode?.id
                  : ""
              }
              disabled={phase === "processing" || phase === "stopping"}
              onChange={(event) => {
                void api
                  .selectMode?.(event.target.value)
                  .catch((reason) => setError(String(reason)));
              }}
            >
              {!availableModes.some((item) => item.id === mode?.id) && (
                <option value="">{mode?.label || t("synapse.title")}</option>
              )}
              {availableModes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <span className={recording ? "sf-status listening" : "sf-status"}>
            {t(
              phase === "preview"
                ? "synapse.overlayPreview"
                : phase === "finished"
                  ? "synapse.overlayCopied"
                  : phase === "processing"
                    ? "overlay.processing"
                    : phase === "stopping"
                      ? "synapse.phases.stopping"
                      : phase === "failed"
                        ? "synapse.overlayFailed"
                        : "synapse.phases.recording",
            )}
          </span>
        </div>
        <FeedbackInterval
          value={interval}
          onChange={(seconds) => {
            setIntervalSeconds(seconds);
            current.current.interval = seconds;
            void api
              .setInterval?.(seconds)
              .catch((reason) => setError(String(reason)));
          }}
        />
        <div className="sf-actions">
          <button
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              const selection = window.getSelection()?.toString();
              const feedback = guidance
                ? [
                    ...(guidance.outline || []),
                    ...(guidance.next_steps || []),
                    ...guidance.missing,
                    ...guidance.deep_dive,
                  ].join("\n")
                : "";
              if (selection || feedback)
                void api
                  .copy(selection || feedback)
                  .catch((reason) => setError(String(reason)));
            }}
          >
            {t("synapse.copy")}
          </button>
          {recording ? (
            <>
              <button
                onClick={() => {
                  const next = !enabled;
                  paused.current = !next;
                  current.current.enabled = next;
                  current.current.revision++;
                  setEnabled(next);
                  setGuidance(null);
                  setBusy(false);
                  setGuidanceError("");
                  void api
                    .setGuidance?.(next)
                    .catch((reason) => setError(String(reason)));
                }}
              >
                {t(
                  enabled ? "synapse.pauseGuidance" : "synapse.resumeGuidance",
                )}
              </button>
              <button onClick={() => void stop()}>{t("synapse.stop")}</button>
              <button onClick={() => void cancel()}>
                {t("synapse.cancel")}
              </button>
            </>
          ) : (
            phase !== "stopping" &&
            phase !== "processing" && (
              <button onClick={close}>{t("synapse.overlayClose")}</button>
            )
          )}
        </div>
      </header>
      <div className="sf-columns">
        <aside>
          <h2>
            {t("synapse.liveGuidance")}
            {busy && <span>{t("synapse.updating")}</span>}
          </h2>
          {guidance && <GuidanceCards guidance={guidance} />}
          {!guidance && (
            <p>
              {t(enabled ? "synapse.guidanceHint" : "synapse.overlayDisabled", {
                seconds: interval,
              })}
            </p>
          )}
          {guidanceError && (
            <p className="sf-error" role="alert">
              {guidanceError}
            </p>
          )}
        </aside>
      </div>
      {error && (
        <p className="sf-error sf-bottom" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
