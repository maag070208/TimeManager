import { Router } from "express";
import { authenticate } from "@core/middlewares/auth.middleware";
import { asyncHandler } from "@core/utils/asyncHandler";
import { registerPath } from "@core/swagger/registry";
import {
  AblyTokenRequestSchema,
  NotificationListResponseSchema,
  UnreadCountSchema,
} from "../models/dto/notification.dto";
import type { NotificationController } from "../controllers/notification.controller";

const bearer = [{ bearerAuth: [] }];

export const createNotificationsRouter = (controller: NotificationController): Router => {
  const router = Router();

  registerPath({
    method: "get",
    path: "/notifications",
    tags: ["Notificaciones"],
    summary: "List the user's notifications",
    security: bearer,
    parameters: [
      { in: "query", name: "unread", required: false, schema: { type: "string" } },
    ],
    responses: {
      200: { description: "List", content: { "application/json": { schema: NotificationListResponseSchema } } },
    },
  });

  registerPath({
    method: "get",
    path: "/notifications/unread-count",
    tags: ["Notificaciones"],
    summary: "Unread count",
    security: bearer,
    responses: {
      200: { description: "Conteo", content: { "application/json": { schema: UnreadCountSchema } } },
    },
  });

  registerPath({
    method: "get",
    path: "/notifications/ably-token",
    tags: ["Notificaciones"],
    summary: "Ably TokenRequest for the user's own channel (subscribe only)",
    description:
      "Signed server-side with the Ably app key; the browser never receives the key. " +
      "Capability is restricted to `user:<id>` with `subscribe`; short TTL.",
    security: bearer,
    responses: {
      200: {
        description: "Ably TokenRequest",
        content: { "application/json": { schema: AblyTokenRequestSchema } },
      },
      503: { description: "Live notifications are not configured" },
    },
  });

  registerPath({
    method: "post",
    path: "/notifications/read-all",
    tags: ["Notificaciones"],
    summary: "Mark all as read",
    security: bearer,
    responses: {
      204: { description: "No content" },
    },
  });

  registerPath({
    method: "post",
    path: "/notifications/{id}/read",
    tags: ["Notificaciones"],
    summary: "Mark one as read",
    security: bearer,
    parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
    responses: {
      204: { description: "No content" },
    },
  });

  registerPath({
    method: "delete",
    path: "/notifications/{id}",
    tags: ["Notificaciones"],
    summary: "Delete notification",
    security: bearer,
    parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
    responses: {
      204: { description: "No content" },
    },
  });

  router.use(authenticate);

  router.get("/", asyncHandler(controller.list));
  router.get("/unread-count", asyncHandler(controller.unreadCount));
  router.get("/ably-token", asyncHandler(controller.ablyToken));
  router.post("/read-all", asyncHandler(controller.markAllRead));
  router.post("/:id/read", asyncHandler(controller.markRead));
  router.delete("/:id", asyncHandler(controller.remove));

  return router;
};