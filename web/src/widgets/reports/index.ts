// API pública del widget "reports": generadores PDF de RH (asistencia, accesos,
// tiempo extra, nómina y checadas).
export { default as AccessReportPDF } from "./ui/AccessReportPDF";
export { default as OvertimePDF } from "./ui/OvertimePDF";
export { default as WeeklyAttendancePdf } from "./ui/WeeklyAttendancePdf";
export {
  downloadAccessReportPDF,
  downloadTimeClockReportPdf,
  downloadOvertimePDF,
  downloadWeeklyAttendancePdf,
  downloadPayrollClosurePdf,
} from "./model/pdf";
