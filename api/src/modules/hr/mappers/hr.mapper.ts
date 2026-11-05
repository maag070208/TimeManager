import { signedObjectUrl } from "@core/services/storage";
import { signedPhotoPath } from "@core/utils/security";
import type { PersonalProfile, EmployeeDocument } from "../models/dto/hr.dto";
import type { PersonalProfileEntity, EmployeeDocumentEntity } from "../models/entity/hr.entity";

const dateOnly = (value: Date | null): string | null =>
  value ? value.toISOString().slice(0, 10) : null;

/**
 * `photoUrl` es la ruta RELATIVA a la base del API de la foto con credencial
 * firmada de corta vida (F1C-01); sin `photoKey` no hay foto. Si firmar fallara
 * (p. ej. sin JWT_SECRET) degradamos a null en vez de tronar la ficha.
 */
const safePhotoUrl = (userId: string, photoKey: string | null): string | null => {
  if (!photoKey) return null;
  try {
    return signedPhotoPath(userId);
  } catch {
    return null;
  }
};

export const personalProfileToDto = (entity: PersonalProfileEntity): PersonalProfile => ({
  id: entity.id,
  username: entity.username,
  name: entity.name,
  email: entity.email,
  role: entity.role,
  active: entity.active,
  jobTitle: entity.jobTitle,
  employeeNumber: entity.employeeNumber,
  department: entity.department,
  subarea: entity.subarea,

  middleName: entity.middleName,
  paternalSurname: entity.paternalSurname,
  maternalSurname: entity.maternalSurname,
  photoUrl: safePhotoUrl(entity.id, entity.photoKey),

  gender: entity.gender,
  bloodType: entity.bloodType,
  medicalConditions: entity.medicalConditions,
  allergies: entity.allergies,

  birthDate: dateOnly(entity.birthDate),
  hireDate: dateOnly(entity.hireDate),

  rfc: entity.rfc,
  curp: entity.curp,
  nss: entity.nss,

  streetAddress: entity.streetAddress,
  neighborhood: entity.neighborhood,
  postalCode: entity.postalCode,
  city: entity.city,
  addressState: entity.addressState,
  country: entity.country,

  personalPhone: entity.personalPhone,
  workPhone: entity.workPhone,

  emergencyContactName: entity.emergencyContactName,
  emergencyContactPhone: entity.emergencyContactPhone,
  emergencyContactRelationship: entity.emergencyContactRelationship,

  discounts: entity.discounts,

  createdAt: entity.createdAt.toISOString(),
});

/**
 * Documento del expediente: la `url` es un GET presignado de S3 (caduca en
 * minutos) porque el bucket es privado; ya no se emiten URLs públicas.
 * Es asíncrono por la firma de la URL.
 */
export const employeeDocumentToDto = async (
  entity: EmployeeDocumentEntity
): Promise<EmployeeDocument> => ({
  id: entity.id,
  documentTypeId: entity.documentTypeId,
  documentType: entity.documentType,
  originalName: entity.originalName,
  mimeType: entity.mimeType,
  sizeBytes: entity.sizeBytes,
  url: await signedObjectUrl(entity.storageKey),
  uploadedById: entity.uploadedById,
  createdAt: entity.createdAt.toISOString(),
});
