import { useTranslation } from "react-i18next";
export default function SynapseWordmark({
  width = 120,
  height,
  className,
}: {
  width?: number;
  height?: number;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <div style={{ width, height }} className={className}>
      <span className="text-2xl font-semibold tracking-tight text-logo-primary">
        {t("synapse.brand")}
      </span>
    </div>
  );
}
