import { Router } from "express";
import { authenticate, requiresAnyPermission, requiresPermission } from "@core/middlewares/auth.middleware";
import { asyncHandler } from "@core/utils/asyncHandler";
import type { NomController } from "../controllers/nom.controller";

/**
 * Rutas NOM (LFT art. 132 fr. XXXIV, registro electrónico de jornada).
 *
 * - Lectura de registros/ajustes/alertas/retención/export: `time_clock.view`
 *   (el export también lo puede bajar quien tenga `payroll.view`).
 * - Escritura (config, ajustes, decisión, barrido, archivado): `time_clock.write`.
 * - `/me/*` solo exige sesión: el trabajador consulta SUS marcajes y reporta
 *   discrepancias sin permisos administrativos.
 */
export const createNomRouter = (controller: NomController): Router => {
  const router = Router();
  const canRead = requiresAnyPermission(["time_clock.view", "payroll.view"]);
  const canWrite = requiresPermission("time_clock.write");

  router.use(authenticate);

  // Autoservicio del trabajador (solo sesión).
  router.get("/me/punches", asyncHandler(controller.myPunches));
  router.post("/me/punch", asyncHandler(controller.remotePunch));
  router.get("/me/discrepancies", asyncHandler(controller.myDiscrepancies));
  router.post("/me/discrepancies", asyncHandler(controller.reportDiscrepancy));

  // NOM-037: estado de teletrabajo del propio trabajador, aceptación de
  // política/aviso y checklist del lugar de trabajo.
  router.get("/me/telework", asyncHandler(controller.myTelework));
  router.post("/me/telework/accept", asyncHandler(controller.acceptTeleworkPolicy));
  router.post("/me/telework/checklist", asyncHandler(controller.submitTeleworkChecklist));

  // NOM-037 (RH): política/desconexión/aviso de privacidad, teletrabajadores,
  // checklists y comunicaciones fuera de jornada.
  router.get("/telework/policy", canRead, asyncHandler(controller.getTeleworkPolicy));
  router.put("/telework/policy", canWrite, asyncHandler(controller.updateTeleworkPolicy));
  router.get("/telework/registrations", canRead, asyncHandler(controller.listTeleworkRegistrations));
  router.post("/telework/registrations", canWrite, asyncHandler(controller.registerTelework));
  router.patch("/telework/registrations/:id", canWrite, asyncHandler(controller.updateTeleworkRegistration));
  router.get("/telework/checklists", canRead, asyncHandler(controller.listTeleworkChecklists));
  router.get("/telework/out-of-hours-contacts", canRead, asyncHandler(controller.listOutOfHoursContacts));
  router.post("/telework/out-of-hours-contacts", canWrite, asyncHandler(controller.registerOutOfHoursContact));

  // Configuración NOM del cliente (límites legales + retención).
  router.get("/config", canRead, asyncHandler(controller.getConfig));
  router.put("/config", canWrite, asyncHandler(controller.updateConfig));

  // Ajustes de checadas (F2-01/F2-02).
  router.get("/punches/:punchId/history", canRead, asyncHandler(controller.punchHistory));
  router.post("/punches/:punchId/adjustments", canWrite, asyncHandler(controller.createAdjustment));
  router.get("/adjustments", canRead, asyncHandler(controller.listAdjustments));
  router.post("/adjustments/:id/approve", canWrite, asyncHandler(controller.decide("APPROVE")));
  router.post("/adjustments/:id/reject", canWrite, asyncHandler(controller.decide("REJECT")));

  // Alertas de límite de jornada (F2-03).
  router.get("/alerts", canRead, asyncHandler(controller.listAlerts));
  router.post("/alerts/scan", canWrite, asyncHandler(controller.scanAlerts));

  // Prueba plena (F3): acuerdo del método de registro y conformidad periódica.
  router.get("/me/record-agreement", asyncHandler(controller.myRecordAgreement));
  router.post("/me/record-agreement/accept", asyncHandler(controller.acceptRecordAgreement));
  router.get("/me/record-acknowledgments", asyncHandler(controller.myAcknowledgments));
  router.post("/me/record-acknowledgments", asyncHandler(controller.acknowledgeRecord));
  router.get("/record-agreements", canRead, asyncHandler(controller.listRecordAgreements));
  router.get("/record-acknowledgments", canRead, asyncHandler(controller.listRecordAcknowledgments));

  // Catálogo de festivos del cliente (art. 74 LFT).
  router.get("/holidays", canRead, asyncHandler(controller.listHolidays));
  router.post("/holidays", canWrite, asyncHandler(controller.createHoliday));
  router.delete("/holidays/:id", canWrite, asyncHandler(controller.deleteHoliday));

  // Motor semanal de horas extra (F1): ledger por persona/semana.
  router.get("/overtime/weekly", canRead, asyncHandler(controller.listWeeklyOvertime));
  router.post("/overtime/weekly/recalculate", canWrite, asyncHandler(controller.recalculateWeeklyOvertime));
  router.post("/overtime/weekly/:id/confirm", canWrite, asyncHandler(controller.confirmWeeklyOvertime));

  // Retención/archivado (F2-04).
  router.get("/retention", canRead, asyncHandler(controller.getRetention));
  router.post("/retention/archive", canWrite, asyncHandler(controller.archive));

  // Export formal del registro de jornada (requisito 4 del checklist LFT 2027).
  router.get("/export/stps", canRead, asyncHandler(controller.exportStps));

  return router;
};
