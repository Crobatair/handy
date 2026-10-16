import { useEffect, useRef, useState } from "react";
import { Clock3, ChevronDown, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import "./FeedbackInterval.css";

export function FeedbackInterval({
  value,
  onChange,
}: {
  value: number;
  onChange: (seconds: number) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div className="feedback-timing" ref={root}>
      <button
        type="button"
        className="feedback-timing-trigger"
        aria-label={t("synapse.interval")}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(!open)}
      >
        <Clock3 size={14} aria-hidden="true" />
        <span>{t("synapse.shortSeconds", { count: value })}</span>
        <ChevronDown size={12} aria-hidden="true" />
      </button>
      {open && (
        <div
          className="feedback-timing-popover"
          role="dialog"
          aria-label={t("synapse.interval")}
        >
          <div className="feedback-timing-heading">
            <strong>{t("synapse.interval")}</strong>
            <span>{t(`synapse.timing.${value}`)}</span>
          </div>
          <p>{t("synapse.timingDescription")}</p>
          <div
            className="feedback-timing-options"
            role="radiogroup"
            aria-label={t("synapse.interval")}
          >
            {[5, 10, 15, 30, 60].map((seconds) => (
              <label key={seconds}>
                <input
                  type="radio"
                  name="feedback-timing"
                  value={seconds}
                  checked={seconds === value}
                  onChange={() => onChange(seconds)}
                  aria-label={t("synapse.seconds", { count: seconds })}
                />
                <span>
                  {seconds === value && <Check size={10} aria-hidden="true" />}
                  {t("synapse.shortSeconds", { count: seconds })}
                </span>
              </label>
            ))}
          </div>
          <div className="feedback-timing-scale">
            <span>{t("synapse.fasterFeedback")}</span>
            <span>{t("synapse.fewerRequests")}</span>
          </div>
          <p className="feedback-timing-note">{t("synapse.onlyNewWords")}</p>
          <button
            type="button"
            className="feedback-timing-done"
            onClick={() => setOpen(false)}
          >
            {t("synapse.timingDone")}
          </button>
        </div>
      )}
    </div>
  );
}
