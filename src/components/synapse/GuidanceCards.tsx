import { useTranslation } from "react-i18next";
import type { Guidance } from "@/lib/synapse/api";
import "./GuidanceCards.css";

export function GuidanceCards({ guidance }: { guidance: Guidance }) {
  const { t } = useTranslation();
  const hints = [
    ...(guidance.next_steps || []),
    ...guidance.missing,
    ...guidance.deep_dive,
  ]
    .filter((item, index, items) => items.indexOf(item) === index)
    .slice(0, 3);
  const usage = guidance.usage;
  const reasoning = usage?.completion_tokens_details?.reasoning_tokens;
  return (
    <>
      <div className="guidance-cards">
        <section
          className="guidance-card"
          aria-label={t("synapse.guidance.outline")}
        >
          <h3>{t("synapse.guidance.outline")}</h3>
          {(guidance.outline || []).length ? (
            <ol>
              {guidance.outline!.slice(0, 2).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ol>
          ) : (
            <p>{t("synapse.outlineWaiting")}</p>
          )}
        </section>
        <section
          className="guidance-card"
          aria-label={t("synapse.guidance.next_steps")}
        >
          <h3>{t("synapse.guidance.next_steps")}</h3>
          {hints.length ? (
            <ol>
              {hints.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ol>
          ) : (
            <p>{t("synapse.noGuidance")}</p>
          )}
        </section>
      </div>
      <p className="guidance-usage" title={t("synapse.usageNote")}>
        {usage
          ? t("synapse.tokenUsage", {
              input: usage.input_tokens ?? "—",
              output: usage.output_tokens ?? "—",
            })
          : t("synapse.usageUnavailable")}
        {reasoning != null && (
          <span>
            {" · "}
            {t("synapse.reasoningUsage", { count: reasoning })}
            {usage?.output_tokens != null &&
              ` · ${t("synapse.visibleUsage", { count: Math.max(0, usage.output_tokens - reasoning) })}`}
          </span>
        )}
      </p>
    </>
  );
}
