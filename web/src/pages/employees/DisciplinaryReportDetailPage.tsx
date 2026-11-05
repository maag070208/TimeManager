import { LottieLoader } from "@shared/ui/lottie-loader";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ITAlert,
  ITButton,
  ITCard,
  ITChip,
  ITFlex,
  ITGrid,
  ITPage,
  ITText,
} from "@axzydev/axzy_ui_system";
import { ProfileAvatar } from "@shared/ui/profile-avatar";
import { FaFilePdf, FaScroll } from "react-icons/fa6";
import { LuCalendarDays } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { formatDate } from "@shared/utils/dates";
import { personalApi, type DisciplinaryReport } from "@entities/hr";
import { DisciplinaryReportPreview, downloadDisciplinaryReportPdf } from "@widgets/disciplinary-report";
import { i18n } from "@shared/i18n";
import { useGoBack } from "@shared/lib/useGoBack";

export default function DisciplinaryReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t: tt } = useTranslation(["disciplinary-reports", "common"]);
  const navigate = useNavigate();
  const goBack = useGoBack();
  const [disciplinaryReport, setDisciplinaryReport] = useState<DisciplinaryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    personalApi
      .disciplinaryReport(id)
      .then(setDisciplinaryReport)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : i18n.t("employees:disciplinary.loadError"))
      )
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <ITPage className="m-0! p-0! px-8! min-w-full! pb-12!"
        noPadding title={tt("preview.title")} backAction={() => goBack("/employees/disciplinary-reports")}>
        <ITFlex justify="center" align="center" className="py-20">
          <LottieLoader size="lg" />
        </ITFlex>
      </ITPage>
    );
  }

  if (error || !disciplinaryReport) {
    return (
      <ITPage className="m-0! p-0! px-8! min-w-full! pb-12!"
        noPadding
        title={tt("preview.title")}
        backAction={() => goBack("/employees/disciplinary-reports")}
        breadcrumbs={[
          { label: tt("common:breadcrumbs.home"), onClick: () => navigate("/") },
          { label: tt("breadcrumb"), onClick: () => navigate("/employees/disciplinary-reports") },
          { label: tt("preview.title") },
        ]}
      >
        <ITAlert variant="error" dismissible onDismiss={() => setError(null)}>
          {error ?? i18n.t("employees:disciplinary.notFound")}
        </ITAlert>
      </ITPage>
    );
  }

  const area = disciplinaryReport.user.department?.name
    ? `${disciplinaryReport.user.department.name}${disciplinaryReport.user.subarea ? ` — ${disciplinaryReport.user.subarea.name}` : ""}`
    : "—";

  return (
    <ITPage className="m-0! p-0! px-8! min-w-full! pb-12!"
      noPadding
      title={tt("preview.title")}
      description={`${disciplinaryReport.user.name} · ${tt(`reasons.${disciplinaryReport.reason}`)}`}
      icon={<FaScroll size={20} />}
      breadcrumbs={[
        { label: tt("common:breadcrumbs.home"), onClick: () => navigate("/") },
        { label: tt("breadcrumb"), onClick: () => navigate("/employees/disciplinary-reports") },
        { label: disciplinaryReport.user.name },
      ]}
      backAction={() => goBack("/employees/disciplinary-reports")}
      actions={
        <ITFlex gap={2}>
          <ITButton variant="outlined" color="secondary" onClick={() => void downloadDisciplinaryReportPdf(disciplinaryReport)}>
            <ITFlex align="center" gap={1}>
              <FaFilePdf className="text-red-600" size={13} />
              <ITText className="font-bold text-[11px]">{tt("preview.download")}</ITText>
            </ITFlex>
          </ITButton>
        </ITFlex>
      }
    >
      <ITFlex direction="column" gap={4}>
        {/* Persona y datos del acta */}
        <ITCard contentClassName="!p-0">
          <ITFlex align="center" gap={3} wrap="wrap" className="px-5 py-4">
            <ProfileAvatar name={disciplinaryReport.user.name} size="lg" className="h-[64px]! w-[64px]!" />
            <ITFlex direction="column" gap={1} className="min-w-0 flex-1">
              <ITText as="h2" className="m-0 line-clamp-1 !text-[20px] font-extrabold leading-tight">
                {disciplinaryReport.user.name}
              </ITText>
              <ITText muted className="m-0 !text-[12.5px]">
                {[disciplinaryReport.user.employeeNumber ? `#${disciplinaryReport.user.employeeNumber}` : null, disciplinaryReport.user.jobTitle, area]
                  .filter(Boolean)
                  .join(" · ")}
              </ITText>
            </ITFlex>
            <ITFlex align="center" gap={1.5} className="shrink-0">
              <ITChip size="md" color="danger" variant="soft">
                {tt(`reasons.${disciplinaryReport.reason}`)}
              </ITChip>
              <ITChip size="md" color="gray" variant="outlined" icon={<LuCalendarDays size={12} />}>
                {formatDate(disciplinaryReport.incidentDate)}
              </ITChip>
            </ITFlex>
          </ITFlex>
        </ITCard>

        <ITGrid container columns={12} spacing={4}>
          <ITGrid item xs={12} lg={5}>
            <ITFlex direction="column" gap={4}>
              <ITCard>
                <ITText muted className="!text-[11px] font-bold uppercase tracking-[0.06em]">
                  {tt("doc.description")}
                </ITText>
                <ITText className="mt-1 whitespace-pre-line !text-[13px] leading-relaxed">
                  {disciplinaryReport.description}
                </ITText>
                <ITFlex align="center" gap={2} className="mt-4   pt-3">
                  <ITText muted className="!text-[11px] font-bold uppercase tracking-[0.06em]">
                    {tt("doc.sanction")}
                  </ITText>
                  <ITText className="!text-[12.5px] font-semibold">{disciplinaryReport.sanction || "—"}</ITText>
                </ITFlex>
              </ITCard>

              <ITCard>
                <ITFlex align="center" gap={2}>
                  <ProfileAvatar name={disciplinaryReport.createdBy?.name ?? ""} size="sm" />
                  <ITFlex direction="column" gap={0} className="min-w-0">
                    <ITText muted className="!text-[11px]">
                      {tt("doc.createdBy")}
                    </ITText>
                    <ITText className="truncate !text-[12.5px] font-semibold">
                      {disciplinaryReport.createdBy?.name ?? "—"}
                    </ITText>
                  </ITFlex>
                  <ITText muted className="ml-auto !text-[11.5px]">
                    {formatDate(disciplinaryReport.createdAt)}
                  </ITText>
                </ITFlex>
              </ITCard>
            </ITFlex>
          </ITGrid>

          <ITGrid item xs={12} lg={7}>
            <ITCard contentClassName="!p-0">
              <ITFlex align="center" justify="between" gap={2} className="px-4 py-3">
                <ITText className="!text-[13px] font-bold">{tt("preview.title")}</ITText>
                <ITText muted className="!text-[11.5px]">
                  {disciplinaryReport.user.name}
                </ITText>
              </ITFlex>
              <div className="overflow-hidden rounded-b-[20px]  ">
                <DisciplinaryReportPreview disciplinaryReport={disciplinaryReport} />
              </div>
            </ITCard>
          </ITGrid>
        </ITGrid>
      </ITFlex>
    </ITPage>
  );
}