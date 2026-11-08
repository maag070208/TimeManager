package com.axzydev.checklab.testing

/*
 * Respuestas reales del API sobre los datos demo locales (`tm_demo`, empresa altamira),
 * recortadas a pocos registros. Incluyen campos que la app no usa a propósito: el
 * decoder debe ignorarlos. En WEEKLY_ATTENDANCE los dos últimos días se cambiaron a
 * ABSENCE e INCOMPLETE para cubrir más estados de la rejilla.
 */

const val CLOCK_SUMMARY = """{"generatedAt":"2026-11-08T14:47:39.972Z","timezone":"America/Mexico_City",
"roster":{"suspicious":false,"pendingRemovals":0,"reappeared":0,"unlinked":8},
"alerts":[{"code":"UNLINKED","severity":"info","count":8}],
"clocks":[{"serial":"MOCK-SERIAL-0001","name":"Andén 3 · Entrada de personal","countsAttendance":true,
"connection":"NO_RESPONSE","lastReadAt":"2026-11-08T14:47:39.993Z","lastSyncAt":"2026-11-07T20:27:40.438Z",
"lastSyncOk":false,"device":null,"counts":null,"punchesToday":0,
"hourly":[{"hour":0,"count":0,"people":[]},{"hour":1,"count":0,"people":[]}],"recentPunches":[],
"alerts":[{"code":"NO_RESPONSE","severity":"critical"},{"code":"SYNC_ERROR","severity":"warning"}]}]}"""

const val CLOCK_ROSTER = """{"lastRun":{"id":"7198c2d2","trigger":"AUTO","ok":false,"suspicious":false,
"perClock":[{"ok":false,"count":0,"error":"connect ECONNREFUSED","serial":"MOCK-SERIAL-0001"}]},
"unlinked":[{"employeeNumber":"1000","name":"PERSONA PRUEBA UNO","clocks":["Andén 3 · Entrada de personal"]},
{"employeeNumber":"1001","name":"PERSONA PRUEBA DOS","clocks":["Andén 3 · Entrada de personal"]}],
"pendingRemovals":[],"reappeared":[]}"""

const val WEEKLY_ATTENDANCE = """{"range":{"start":"2026-11-04T06:00:00.000Z","end":"2026-11-11T06:00:00.000Z",
"timezone":"America/Mexico_City","days":["2026-11-04","2026-11-05","2026-11-06","2026-11-07","2026-11-08","2026-11-09","2026-11-10"]},
"rows":[{"userId":"80ae7cd8","employeeNumber":"0121","clockNumbers":["0121"],"name":"Andrés Chávez Álvarez","jobTitle":"Surtidor",
"departmentId":"c23f4023","departmentName":"Almacén","payrollPosition":{"name":"Auxiliar de almacén","dailySalary":315.04,"sbcDaily":331.2},
"active":true,"linked":true,"scheduleName":"Vespertino almacén","withoutSchedule":false,
"days":[{"date":"2026-11-04","status":"WORKED","entryAt":"2026-11-04T20:50:06.000Z","exitAt":"2026-11-05T05:06:05.000Z",
"sessions":[{"entryAt":"2026-11-04T20:50:06.000Z","exitAt":"2026-11-05T05:06:05.000Z","workedMinutes":496,"incident":null}],
"workedMin":496,"scheduledMin":450,"extraMin":0,"missingMin":0,"lateMin":0,"shift":"15:00-23:00","approval":null,"approvedExtraMin":0},
{"date":"2026-11-05","status":"OVERTIME","entryAt":"2026-11-05T20:57:56.000Z","exitAt":"2026-11-06T05:45:58.000Z",
"workedMin":528,"scheduledMin":450,"extraMin":36,"missingMin":0,"lateMin":0,"shift":"15:00-23:00","approval":"PENDING","approvedExtraMin":0},
{"date":"2026-11-06","status":"ABSENCE","entryAt":null,"exitAt":null,"workedMin":0,"scheduledMin":450,"lateMin":0},
{"date":"2026-11-07","status":"INCOMPLETE","entryAt":"2026-11-07T21:12:00.000Z","exitAt":null,"lateMin":12}],
"totals":{"workedMin":1523,"scheduledMin":1620,"extraMin":36}}]}"""

const val NOM_CONFIG = """{"workdayLimitMinutes":720,"weekStartDay":3,
"attendanceDefaults":{"entryToleranceMin":10,"exitToleranceMin":10,"mealBreakMin":30,"minOvertimeMin":30},
"weeklyLimitMinutes":2880,"retentionMonths":60,"remotePunchEnabled":true,"remoteCountsForWorkday":true,
"blockRemoteWithoutAgreement":true,"requireUnionForCollective":true,
"policy":{"teleworkPolicy":"…","policyVersion":1},
"source":{"workdayLimit":"tenant","weeklyLimit":"legal_default","retention":"tenant"},
"legal":{"year":2026,"weeklyLimitMinutes":2880,"workdayLimitMinutes":720}}"""

const val AUDIT_PAGE = """{"data":[{"id":"ff76aa96","action":"NOM_SETTINGS_UPDATED","module":"NomSettings","userName":"ricardo.salinas",
"createdAt":"2026-11-08T01:34:18.102Z","newState":{"remotePunchEnabled":true},"ipAddress":"127.0.0.1"},
{"id":"8505d00e","action":"REMOTE_PUNCH_RECORDED","module":"RemotePunch","userName":"ricardo.salinas",
"createdAt":"2026-11-08T00:25:22.688Z","newState":{"type":"ENTRY","hasGeolocation":true},"ipAddress":"127.0.0.1"}],
"total":88,"page":1,"limit":2,"nextCursor":"eyJjIjoi"}"""

const val TELEWORK_REGISTRATIONS = """[{"id":"05d735e9","userId":"bf195869","userName":"Valeria Ibarra Contreras",
"email":"valeria.ibarra@altamira-logistica.test","employeeNumber":"0143","mode":"REMOTO","status":"ACTIVE",
"homeAddress":"Av. Juárez 201, Los Reyes Ixtacala, Tlalnepantla de Baz","startedAt":"2026-11-02T15:00:00.000Z","endedAt":null,
"consentAcceptedAt":"2026-11-02T15:15:00.000Z","consentPolicyVersion":1,"notes":null,
"lastChecklist":{"kind":"PERIODIC","completedAt":"2026-11-04T16:00:00.000Z"},"nextPeriodicDueAt":"2027-11-04T16:00:00.000Z"}]"""

const val DISTRIBUTION_AGREEMENTS = """[{"id":"a1e5d8eb","tenantId":"t1","userId":"f5f0fd6e","scheduleId":"04b7b86b",
"kind":"INDIVIDUAL","party":"WORKER","scope":"HORARIO","effectiveFrom":"2026-07-13T00:00:00.000Z","effectiveTo":null,
"evidenceText":"Convenio de distribución de jornada «Nocturno» (art. 59 LFT).","acceptedHash":"f1bc2b0e",
"acceptedAt":"2026-07-13T18:47:00.000Z","acceptedIp":"187.190.124.87",
"user":{"name":"Guadalupe Isabel Ramírez Rodríguez","employeeNumber":"0127"},"acceptedBy":{"name":"Guadalupe Isabel Ramírez Rodríguez"}}]"""

const val ROLES = """[{"key":"ADMIN","name":"ADMINISTRADOR","module":"Plataforma","active":true,"userCount":0},
{"key":"CLIENT_ADMIN","name":"ADMINISTRADOR DEL CLIENTE","description":"Administra la operación de su empresa.",
"module":"Cliente","staff":true,"system":true,"active":true,"sortOrder":3,"userCount":1}]"""
