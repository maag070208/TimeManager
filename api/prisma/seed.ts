/**
 * Arranque de una base nueva: crea el usuario ADMIN inicial si no existe.
 * Las contraseñas NO tienen valor por defecto: deben venir del entorno.
 *
 *   INITIAL_ADMIN_USERNAME=admin INITIAL_ADMIN_PASSWORD='...' pnpm seed
 *
 * Primero siembra roles, permisos y matriz desde `prisma/seed-data` (insert-missing).
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "@core/utils/security";
import { seedPermissionsFromFixtures } from "@core/permissions";
import { seedPlansFromFixtures } from "@core/plans";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const username = process.env.INITIAL_ADMIN_USERNAME?.trim();
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!username || !password || password.length < 8) {
    throw new Error("Define INITIAL_ADMIN_USERNAME e INITIAL_ADMIN_PASSWORD (mínimo 8 caracteres).");
  }
  await seedPermissionsFromFixtures(prisma);
  await seedPlansFromFixtures(prisma);
  const existing = await prisma.user.findFirst({ where: { username } });
  if (existing) {
    console.log(`Usuario ${username} ya existe; no se modifica.`);
    return;
  }
  await prisma.user.create({
    data: {
      username,
      name: "Administrador",
      password: await hashPassword(password),
      role: "ADMIN",
      active: true,
    },
  });
  console.log(`Administrador ${username} creado.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
