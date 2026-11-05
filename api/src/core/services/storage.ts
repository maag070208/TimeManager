import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@core/config/env.config";
import { HttpError } from "@core/middlewares/error.middleware";

/**
 * S3 del expediente (fotos y documentos). El bucket DEBE ser privado: aquí no
 * se construye ninguna URL pública de objeto. Toda lectura pasa por
 * `downloadObject` (proxy del API) o por `signedObjectUrl` (GET presignado que
 * caduca). El cambio de política del bucket es de infraestructura, no de este
 * código; ver `docs/modules/hr.md`.
 */
const configured = Boolean(
  env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.AWS_BUCKET_NAME
);

const client = configured
  ? new S3Client({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
      },
      // Evita que el SDK agregue automaticamente parametros de checksum
      // (p.ej. x-amz-checksum-mode) a los requests, evitando efectos
      // secundarios inesperados en la firma de las peticiones a S3.
      // https://github.com/aws/aws-sdk-js-v3/issues/6994
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    })
  : null;

/** Vida de las URLs de descarga firmadas (10 min). */
export const OBJECT_URL_EXPIRES_IN = 600;

const requireStorage = (): { client: S3Client; bucket: string } => {
  if (!client || !env.AWS_BUCKET_NAME) {
    throw new HttpError(503, "STORAGE_NOT_CONFIGURED");
  }
  return { client, bucket: env.AWS_BUCKET_NAME };
};

export const uploadObject = async (key: string, body: Buffer, contentType: string) => {
  const { client: s3, bucket } = requireStorage();
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
};

/** Lee el objeto con credenciales IAM (nunca por URL pública). */
export const downloadObject = async (key: string) => {
  const { client: s3, bucket } = requireStorage();
  const result = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!result.Body) throw new HttpError(404, "FILE_NOT_FOUND");
  return Buffer.from(await result.Body.transformToByteArray());
};

/**
 * URL de descarga firmada (`GetObjectCommand` presignado, caduca). Sustituye a
 * la antigua URL pública de S3: con el bucket privado es la única vía directa
 * al objeto, y el cliente no necesita credenciales IAM.
 */
export const signedObjectUrl = async (
  key: string,
  expiresIn: number = OBJECT_URL_EXPIRES_IN
): Promise<string> => {
  const { client: s3, bucket } = requireStorage();
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn });
};
