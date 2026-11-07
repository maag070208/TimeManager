/**
 * Empresas ficticias del seed demo. Todo es inventado: nombres, RFC, domicilios
 * y correos (dominio reservado `.test`, nunca entregable).
 *
 * Horarios: `days` usa 1=lunes … 7=domingo; `null` = descanso.
 */
export type CheckinMode = "WEB" | "CLOCK" | "HYBRID";
export type RoleKey = "CLIENT_ADMIN" | "HUMAN_RESOURCES" | "CLIENT_STAFF";
type Shift = [string, string] | null;

export interface ScheduleSpec {
  name: string;
  days: Record<1 | 2 | 3 | 4 | 5 | 6 | 7, Shift>;
  mealBreakMin: number;
  crossesMidnight?: boolean;
  /** Probabilidad diaria de quedarse tiempo extra (además del sesgo de la persona). */
  overtimeChance: number;
  /** Si trabaja los días festivos (guardias, almacén). */
  worksHolidays?: boolean;
}

export interface RosterSpec {
  department: string;
  subarea?: string;
  jobTitle: string;
  schedule: string;
  position: string;
  count: number;
  checkin?: CheckinMode;
  clock?: string;
  telework?: "REMOTO" | "HIBRIDO";
}

export interface KeyPerson extends Omit<RosterSpec, "count"> {
  username: string;
  first: string;
  middle?: string;
  paternal: string;
  maternal: string;
  gender: "M" | "F";
  role: RoleKey;
  birthDate: string;
  hireDate: string;
}

export interface CompanySpec {
  slug: string;
  name: string;
  legalName: string;
  rfc: string;
  city: string;
  state: string;
  stateCode: string;
  neighborhoods: string[];
  postalPrefix: string;
  emailDomain: string;
  brandColor: string;
  /** 0 = plan chico, 1 = mediano, 2 = grande (por precio del catálogo). */
  planTier: 0 | 1 | 2;
  weekStartDay: number;
  createdAt: string;
  departments: Record<string, string[]>;
  schedules: ScheduleSpec[];
  positions: Array<{ name: string; jobTitle: string; daily: string; sbc: string }>;
  clocks: Array<{ serial: string; name: string; model: string; url: string }>;
  keyPeople: KeyPerson[];
  roster: RosterSpec[];
  conventionHolidays?: Array<{ date: string; name: string }>;
  teleworkPolicy?: string;
}

const weekdays = (shift: Shift, saturday: Shift = null, sunday: Shift = null): ScheduleSpec["days"] => ({
  1: shift,
  2: shift,
  3: shift,
  4: shift,
  5: shift,
  6: saturday,
  7: sunday,
});

export const COMPANIES: CompanySpec[] = [
  {
    slug: "altamira",
    name: "Grupo Logístico Altamira",
    legalName: "Grupo Logístico Altamira, S.A. de C.V.",
    rfc: "GLA140812QK3",
    city: "Tlalnepantla de Baz",
    state: "Estado de México",
    stateCode: "MC",
    neighborhoods: ["Los Reyes Ixtacala", "San Juan Ixhuatepec", "Valle Dorado", "El Rosario", "Lomas de Valle Dorado", "Viveros de la Loma"],
    postalPrefix: "540",
    emailDomain: "altamira-logistica.test",
    brandColor: "#0F766E",
    planTier: 2,
    weekStartDay: 3,
    createdAt: "2026-04-14T16:00:00Z",
    departments: {
      Almacén: ["Recepción", "Surtido", "Embarques"],
      Transporte: ["Operadores", "Despacho"],
      Mantenimiento: [],
      Administración: ["Finanzas", "Compras"],
      "Recursos Humanos": [],
    },
    schedules: [
      { name: "Matutino almacén", days: weekdays(["07:00", "15:00"], ["07:00", "12:00"]), mealBreakMin: 30, overtimeChance: 0.18 },
      { name: "Vespertino almacén", days: weekdays(["15:00", "23:00"], ["12:00", "17:00"]), mealBreakMin: 30, overtimeChance: 0.12 },
      { name: "Nocturno", days: weekdays(["23:00", "06:00"]), mealBreakMin: 0, crossesMidnight: true, overtimeChance: 0.05, worksHolidays: true },
      { name: "Operadores de ruta", days: weekdays(["06:00", "15:00"], ["06:00", "11:00"]), mealBreakMin: 60, overtimeChance: 0.25 },
      { name: "Oficina", days: weekdays(["09:00", "18:00"]), mealBreakMin: 60, overtimeChance: 0.06 },
    ],
    positions: [
      { name: "Auxiliar de almacén", jobTitle: "Auxiliar de almacén", daily: "315.04", sbc: "331.20" },
      { name: "Montacarguista", jobTitle: "Montacarguista", daily: "380.00", sbc: "399.50" },
      { name: "Operador de tractocamión", jobTitle: "Operador", daily: "520.00", sbc: "546.70" },
      { name: "Supervisión", jobTitle: "Supervisor", daily: "610.00", sbc: "641.30" },
      { name: "Administrativo", jobTitle: "Analista", daily: "450.00", sbc: "473.10" },
      { name: "Gerencia", jobTitle: "Gerente", daily: "1150.00", sbc: "1209.00" },
    ],
    clocks: [
      { serial: "AL-K1T671-0193", name: "Andén 3 · Entrada de personal", model: "DS-K1T671MF", url: "http://10.40.1.21" },
      { serial: "AL-K1T341-0457", name: "Oficinas corporativas", model: "DS-K1T341AMF", url: "http://10.40.1.22" },
    ],
    keyPeople: [
      { username: "ricardo.salinas", first: "Ricardo", paternal: "Salinas", maternal: "Treviño", gender: "M", role: "CLIENT_ADMIN", department: "Administración", jobTitle: "Director de operaciones", schedule: "Oficina", position: "Gerencia", checkin: "HYBRID", clock: "AL-K1T341-0457", birthDate: "1979-03-22", hireDate: "2014-08-18" },
      { username: "veronica.ibarra", first: "Verónica", paternal: "Ibarra", maternal: "Luna", gender: "F", role: "HUMAN_RESOURCES", department: "Recursos Humanos", jobTitle: "Jefa de Recursos Humanos", schedule: "Oficina", position: "Gerencia", checkin: "HYBRID", clock: "AL-K1T341-0457", birthDate: "1986-11-05", hireDate: "2018-02-12" },
      { username: "hugo.castaneda", first: "Hugo", middle: "Armando", paternal: "Castañeda", maternal: "Ruiz", gender: "M", role: "CLIENT_STAFF", department: "Almacén", subarea: "Surtido", jobTitle: "Supervisor de almacén", schedule: "Matutino almacén", position: "Supervisión", checkin: "CLOCK", clock: "AL-K1T671-0193", birthDate: "1984-06-30", hireDate: "2015-01-19" },
      { username: "karla.nunez", first: "Karla", paternal: "Núñez", maternal: "Ortega", gender: "F", role: "CLIENT_STAFF", department: "Administración", subarea: "Finanzas", jobTitle: "Analista de costos", schedule: "Oficina", position: "Administrativo", checkin: "HYBRID", clock: "AL-K1T341-0457", telework: "HIBRIDO", birthDate: "1994-09-14", hireDate: "2021-05-03" },
    ],
    roster: [
      { department: "Almacén", subarea: "Recepción", jobTitle: "Auxiliar de recepción", schedule: "Matutino almacén", position: "Auxiliar de almacén", count: 6, checkin: "CLOCK", clock: "AL-K1T671-0193" },
      { department: "Almacén", subarea: "Surtido", jobTitle: "Surtidor", schedule: "Matutino almacén", position: "Auxiliar de almacén", count: 7, checkin: "CLOCK", clock: "AL-K1T671-0193" },
      { department: "Almacén", subarea: "Surtido", jobTitle: "Surtidor", schedule: "Vespertino almacén", position: "Auxiliar de almacén", count: 6, checkin: "CLOCK", clock: "AL-K1T671-0193" },
      { department: "Almacén", subarea: "Embarques", jobTitle: "Montacarguista", schedule: "Vespertino almacén", position: "Montacarguista", count: 3, checkin: "CLOCK", clock: "AL-K1T671-0193" },
      { department: "Almacén", subarea: "Embarques", jobTitle: "Montacarguista", schedule: "Nocturno", position: "Montacarguista", count: 4, checkin: "CLOCK", clock: "AL-K1T671-0193" },
      { department: "Transporte", subarea: "Operadores", jobTitle: "Operador de tractocamión", schedule: "Operadores de ruta", position: "Operador de tractocamión", count: 6, checkin: "CLOCK", clock: "AL-K1T671-0193" },
      { department: "Transporte", subarea: "Despacho", jobTitle: "Despachador", schedule: "Oficina", position: "Administrativo", count: 2, checkin: "HYBRID", clock: "AL-K1T341-0457" },
      { department: "Mantenimiento", jobTitle: "Técnico de mantenimiento", schedule: "Matutino almacén", position: "Montacarguista", count: 2, checkin: "CLOCK", clock: "AL-K1T671-0193" },
      { department: "Administración", subarea: "Compras", jobTitle: "Comprador", schedule: "Oficina", position: "Administrativo", count: 2, checkin: "HYBRID", clock: "AL-K1T341-0457" },
      { department: "Administración", subarea: "Finanzas", jobTitle: "Auxiliar contable", schedule: "Oficina", position: "Administrativo", count: 1, checkin: "WEB", telework: "REMOTO" },
      { department: "Recursos Humanos", jobTitle: "Auxiliar de nómina", schedule: "Oficina", position: "Administrativo", count: 1, checkin: "HYBRID", clock: "AL-K1T341-0457" },
    ],
    teleworkPolicy:
      "El teletrabajo aplica a puestos administrativos que no requieren presencia en el CEDIS. La jornada, los canales de comunicación y la desconexión digital se rigen por el horario pactado.",
  },
  {
    slug: "santalucia",
    name: "Clínica Santa Lucía",
    legalName: "Servicios Médicos Santa Lucía de Occidente, S.C.",
    rfc: "SMS0905274H8",
    city: "Guadalajara",
    state: "Jalisco",
    stateCode: "JC",
    neighborhoods: ["Providencia", "Chapultepec", "Americana", "Jardines del Bosque", "Ladrón de Guevara", "Santa Tere"],
    postalPrefix: "446",
    emailDomain: "clinicasantalucia.test",
    brandColor: "#2563EB",
    planTier: 1,
    weekStartDay: 1,
    createdAt: "2026-06-02T17:30:00Z",
    departments: {
      Enfermería: ["Hospitalización", "Urgencias"],
      "Cuerpo médico": [],
      Laboratorio: [],
      "Recepción y caja": [],
      "Facturación y cobranza": [],
      Limpieza: [],
      "Recursos Humanos": [],
    },
    schedules: [
      { name: "Enfermería matutino", days: weekdays(["07:00", "15:00"], ["07:00", "15:00"]), mealBreakMin: 30, overtimeChance: 0.1, worksHolidays: true },
      { name: "Enfermería vespertino", days: weekdays(["15:00", "22:00"], ["15:00", "22:00"]), mealBreakMin: 30, overtimeChance: 0.1, worksHolidays: true },
      { name: "Guardia nocturna", days: { 1: ["21:00", "07:00"], 2: null, 3: ["21:00", "07:00"], 4: null, 5: ["21:00", "07:00"], 6: null, 7: null }, mealBreakMin: 0, crossesMidnight: true, overtimeChance: 0.04, worksHolidays: true },
      { name: "Laboratorio", days: weekdays(["07:00", "15:00"], ["08:00", "13:00"]), mealBreakMin: 30, overtimeChance: 0.06 },
      { name: "Recepción", days: weekdays(["08:00", "16:00"], ["09:00", "14:00"]), mealBreakMin: 30, overtimeChance: 0.03 },
      { name: "Administrativo", days: weekdays(["09:00", "17:00"]), mealBreakMin: 60, overtimeChance: 0.05 },
    ],
    positions: [
      { name: "Enfermería general", jobTitle: "Enfermera general", daily: "520.00", sbc: "546.70" },
      { name: "Enfermería especialista", jobTitle: "Enfermera especialista", daily: "690.00", sbc: "725.40" },
      { name: "Químico", jobTitle: "Químico clínico", daily: "640.00", sbc: "672.80" },
      { name: "Médico", jobTitle: "Médico adscrito", daily: "1380.00", sbc: "1450.80" },
      { name: "Recepción", jobTitle: "Recepcionista", daily: "340.00", sbc: "357.40" },
      { name: "Intendencia", jobTitle: "Intendente", daily: "315.04", sbc: "331.20" },
      { name: "Administración", jobTitle: "Administrativo", daily: "480.00", sbc: "504.60" },
      { name: "Dirección", jobTitle: "Director", daily: "1650.00", sbc: "1734.60" },
    ],
    clocks: [{ serial: "SL-K1T804-1120", name: "Acceso de personal · Planta baja", model: "DS-K1T804AMF", url: "http://192.168.20.15" }],
    keyPeople: [
      { username: "lucia.arellano", first: "Lucía", paternal: "Arellano", maternal: "Vega", gender: "F", role: "CLIENT_ADMIN", department: "Cuerpo médico", jobTitle: "Directora médica", schedule: "Administrativo", position: "Dirección", checkin: "HYBRID", clock: "SL-K1T804-1120", birthDate: "1975-01-17", hireDate: "2009-05-27" },
      { username: "gabriel.orozco", first: "Gabriel", paternal: "Orozco", maternal: "Padilla", gender: "M", role: "HUMAN_RESOURCES", department: "Recursos Humanos", jobTitle: "Coordinador de capital humano", schedule: "Administrativo", position: "Administración", checkin: "HYBRID", clock: "SL-K1T804-1120", birthDate: "1988-04-09", hireDate: "2017-09-04" },
      { username: "teresa.villalobos", first: "Teresa", paternal: "Villalobos", maternal: "Cárdenas", gender: "F", role: "CLIENT_STAFF", department: "Enfermería", subarea: "Hospitalización", jobTitle: "Jefa de enfermeras", schedule: "Enfermería matutino", position: "Enfermería especialista", checkin: "CLOCK", clock: "SL-K1T804-1120", birthDate: "1982-12-01", hireDate: "2011-03-14" },
      { username: "andrea.preciado", first: "Andrea", paternal: "Preciado", maternal: "Gallardo", gender: "F", role: "CLIENT_STAFF", department: "Facturación y cobranza", jobTitle: "Analista de cobranza", schedule: "Administrativo", position: "Administración", checkin: "WEB", telework: "REMOTO", birthDate: "1996-07-23", hireDate: "2022-01-10" },
    ],
    roster: [
      { department: "Enfermería", subarea: "Hospitalización", jobTitle: "Enfermera general", schedule: "Enfermería matutino", position: "Enfermería general", count: 5, checkin: "CLOCK", clock: "SL-K1T804-1120" },
      { department: "Enfermería", subarea: "Hospitalización", jobTitle: "Enfermera general", schedule: "Enfermería vespertino", position: "Enfermería general", count: 4, checkin: "CLOCK", clock: "SL-K1T804-1120" },
      { department: "Enfermería", subarea: "Urgencias", jobTitle: "Enfermera de urgencias", schedule: "Guardia nocturna", position: "Enfermería especialista", count: 3, checkin: "CLOCK", clock: "SL-K1T804-1120" },
      { department: "Cuerpo médico", jobTitle: "Médico adscrito", schedule: "Enfermería matutino", position: "Médico", count: 3, checkin: "CLOCK", clock: "SL-K1T804-1120" },
      { department: "Laboratorio", jobTitle: "Químico clínico", schedule: "Laboratorio", position: "Químico", count: 3, checkin: "CLOCK", clock: "SL-K1T804-1120" },
      { department: "Recepción y caja", jobTitle: "Recepcionista", schedule: "Recepción", position: "Recepción", count: 3, checkin: "CLOCK", clock: "SL-K1T804-1120" },
      { department: "Facturación y cobranza", jobTitle: "Auxiliar de facturación", schedule: "Administrativo", position: "Administración", count: 2, checkin: "HYBRID", clock: "SL-K1T804-1120", telework: "HIBRIDO" },
      { department: "Limpieza", jobTitle: "Intendente", schedule: "Enfermería matutino", position: "Intendencia", count: 3, checkin: "CLOCK", clock: "SL-K1T804-1120" },
    ],
    conventionHolidays: [{ date: "2026-12-12", name: "Día de la Virgen de Guadalupe (convenio)" }],
    teleworkPolicy:
      "Facturación y cobranza pueden laborar en modalidad remota o híbrida. La clínica provee equipo de cómputo y apoyo para internet; el personal se desconecta al terminar su jornada.",
  },
  {
    slug: "origen",
    name: "Café Origen",
    legalName: "Tostadores Origen, S.A.P.I. de C.V.",
    rfc: "TOR1803156J2",
    city: "Ciudad de México",
    state: "Ciudad de México",
    stateCode: "DF",
    neighborhoods: ["Roma Norte", "Condesa", "Del Carmen", "Narvarte", "Escandón", "Portales"],
    postalPrefix: "067",
    emailDomain: "cafeorigen.test",
    brandColor: "#B45309",
    planTier: 0,
    weekStartDay: 1,
    createdAt: "2026-08-20T15:00:00Z",
    departments: {
      "Sucursal Roma": [],
      "Sucursal Condesa": [],
      "Sucursal Coyoacán": [],
      Tostaduría: [],
      "Oficina central": [],
    },
    schedules: [
      { name: "Apertura", days: weekdays(["06:30", "14:30"], ["07:00", "15:00"]), mealBreakMin: 30, overtimeChance: 0.06 },
      { name: "Cierre", days: { 1: null, 2: ["13:30", "21:30"], 3: ["13:30", "21:30"], 4: ["13:30", "21:30"], 5: ["13:30", "22:00"], 6: ["13:30", "22:00"], 7: ["12:00", "20:00"] }, mealBreakMin: 30, overtimeChance: 0.08 },
      { name: "Tostaduría", days: weekdays(["08:00", "16:00"]), mealBreakMin: 30, overtimeChance: 0.07 },
      { name: "Oficina", days: weekdays(["09:00", "18:00"]), mealBreakMin: 60, overtimeChance: 0.04 },
    ],
    positions: [
      { name: "Barista", jobTitle: "Barista", daily: "315.04", sbc: "331.20" },
      { name: "Encargado de sucursal", jobTitle: "Encargada de sucursal", daily: "460.00", sbc: "483.60" },
      { name: "Tostador", jobTitle: "Tostador", daily: "420.00", sbc: "441.50" },
      { name: "Corporativo", jobTitle: "Coordinador", daily: "720.00", sbc: "757.00" },
    ],
    clocks: [
      { serial: "OR-K1T320-0071", name: "Sucursal Roma", model: "DS-K1T320MFWX", url: "http://192.168.1.64" },
      { serial: "OR-K1T320-0072", name: "Sucursal Condesa", model: "DS-K1T320MFWX", url: "http://192.168.2.64" },
      { serial: "OR-K1T320-0073", name: "Sucursal Coyoacán", model: "DS-K1T320MFWX", url: "http://192.168.3.64" },
    ],
    keyPeople: [
      { username: "mateo.lozano", first: "Mateo", paternal: "Lozano", maternal: "Aguirre", gender: "M", role: "CLIENT_ADMIN", department: "Oficina central", jobTitle: "Fundador y director general", schedule: "Oficina", position: "Corporativo", checkin: "WEB", birthDate: "1987-02-11", hireDate: "2018-03-15" },
      { username: "paola.duarte", first: "Paola", paternal: "Duarte", maternal: "Rosales", gender: "F", role: "HUMAN_RESOURCES", department: "Oficina central", jobTitle: "Coordinadora de personas", schedule: "Oficina", position: "Corporativo", checkin: "WEB", birthDate: "1991-10-28", hireDate: "2020-07-06" },
      { username: "itzel.camacho", first: "Itzel", paternal: "Camacho", maternal: "Soto", gender: "F", role: "CLIENT_STAFF", department: "Sucursal Roma", jobTitle: "Encargada de sucursal", schedule: "Apertura", position: "Encargado de sucursal", checkin: "CLOCK", clock: "OR-K1T320-0071", birthDate: "1995-05-19", hireDate: "2019-11-04" },
    ],
    roster: [
      { department: "Sucursal Roma", jobTitle: "Barista", schedule: "Apertura", position: "Barista", count: 2, checkin: "CLOCK", clock: "OR-K1T320-0071" },
      { department: "Sucursal Roma", jobTitle: "Barista", schedule: "Cierre", position: "Barista", count: 3, checkin: "CLOCK", clock: "OR-K1T320-0071" },
      { department: "Sucursal Condesa", jobTitle: "Encargado de sucursal", schedule: "Apertura", position: "Encargado de sucursal", count: 1, checkin: "CLOCK", clock: "OR-K1T320-0072" },
      { department: "Sucursal Condesa", jobTitle: "Barista", schedule: "Apertura", position: "Barista", count: 2, checkin: "CLOCK", clock: "OR-K1T320-0072" },
      { department: "Sucursal Condesa", jobTitle: "Barista", schedule: "Cierre", position: "Barista", count: 2, checkin: "CLOCK", clock: "OR-K1T320-0072" },
      { department: "Sucursal Coyoacán", jobTitle: "Encargado de sucursal", schedule: "Apertura", position: "Encargado de sucursal", count: 1, checkin: "CLOCK", clock: "OR-K1T320-0073" },
      { department: "Sucursal Coyoacán", jobTitle: "Barista", schedule: "Apertura", position: "Barista", count: 2, checkin: "CLOCK", clock: "OR-K1T320-0073" },
      { department: "Sucursal Coyoacán", jobTitle: "Barista", schedule: "Cierre", position: "Barista", count: 2, checkin: "CLOCK", clock: "OR-K1T320-0073" },
      { department: "Tostaduría", jobTitle: "Tostador", schedule: "Tostaduría", position: "Tostador", count: 2, checkin: "CLOCK", clock: "OR-K1T320-0071" },
      { department: "Oficina central", jobTitle: "Analista de compras", schedule: "Oficina", position: "Corporativo", count: 1, checkin: "WEB", telework: "HIBRIDO" },
    ],
  },
];

export const MALE_NAMES = ["José", "Juan", "Luis", "Carlos", "Jorge", "Miguel", "Alejandro", "Fernando", "Eduardo", "Javier", "Roberto", "Daniel", "Arturo", "Héctor", "Raúl", "Sergio", "Óscar", "Iván", "Diego", "Emiliano", "Mauricio", "Gerardo", "Rodrigo", "Andrés", "Pablo", "Ernesto", "Alberto", "Rubén", "Santiago", "Leonardo"];
export const FEMALE_NAMES = ["María", "Guadalupe", "Ana", "Fernanda", "Gabriela", "Daniela", "Mariana", "Alejandra", "Patricia", "Claudia", "Adriana", "Leticia", "Sofía", "Valeria", "Brenda", "Diana", "Ximena", "Rocío", "Elena", "Montserrat", "Jimena", "Laura", "Silvia", "Regina", "Natalia", "Carolina", "Miriam", "Yesenia", "Alma", "Estefanía"];
export const MIDDLE_MALE = ["Antonio", "Alberto", "Manuel", "Ángel", "Francisco", "Eduardo", "Alejandro"];
export const MIDDLE_FEMALE = ["Isabel", "Fernanda", "José", "Guadalupe", "Elena", "Luisa", "Cristina"];
export const SURNAMES = ["Hernández", "García", "Martínez", "López", "González", "Pérez", "Rodríguez", "Sánchez", "Ramírez", "Cruz", "Flores", "Gómez", "Morales", "Vázquez", "Reyes", "Jiménez", "Torres", "Díaz", "Gutiérrez", "Ruiz", "Mendoza", "Aguilar", "Ortiz", "Moreno", "Castillo", "Romero", "Álvarez", "Méndez", "Chávez", "Rivera", "Juárez", "Ramos", "Domínguez", "Herrera", "Medina", "Castro", "Vargas", "Guzmán", "Velázquez", "Rojas", "Contreras", "Salazar", "Luna", "Ortega", "Cervantes", "Estrada", "Bautista", "Delgado", "Navarro", "Ibarra"];
export const STREETS = ["Av. Insurgentes", "Calle Morelos", "Av. Juárez", "Calle Hidalgo", "Calle Allende", "Av. Revolución", "Calle Zaragoza", "Calle Aldama", "Av. de los Maestros", "Calle Guerrero", "Calle Matamoros", "Av. Independencia"];
export const CONDITIONS = [null, null, null, null, "Hipertensión controlada", "Asma leve", null, "Diabetes tipo 2", null, null];
export const ALLERGIES = [null, null, null, "Penicilina", null, "Polen", null, null, "Mariscos", null];
export const RELATIONSHIPS = ["Esposa", "Esposo", "Madre", "Padre", "Hermana", "Hermano", "Hija", "Hijo"];
