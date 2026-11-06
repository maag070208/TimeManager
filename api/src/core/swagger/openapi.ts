import { OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { registry } from "./registry";
import { env } from "@core/config/env.config";

registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});

export const buildOpenApiDocument = () => {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: "3.0.0",
    info: {
      title: "CheckLab API",
      version: "1.0.0",
      description:
        "CheckLab API. JWT authentication (Bearer). Roles: ADMIN, SUPPORT, CLIENT_ADMIN, HUMAN_RESOURCES, CLIENT_STAFF.",
    },
    servers: [
      {
        url: `/api/v1`,
        description: env.NODE_ENV,
      },
    ],
    tags: [
      { name: "Auth", description: "Authentication and session" },
      { name: "Health", description: "Service health" },
    ],
  });
};