export interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  detail?: string;
  ticketId?: string;
}

export interface NotifyUserCreatedInput {
  userId: string;
  actorId: string;
  userName: string;
  userEmail?: string | null;
}

export interface NotifyUserDeactivatedInput {
  userId: string;
  actorId: string;
  userName: string;
  reason: string;
  date: string;
}

export interface NotifyRosterAlertInput {
  pending: number;
  reappeared: number;
  suspicious: boolean;
}

export interface NotifyDocumentUploadedInput {
  userId: string;
  documentId: string;
  documentName: string;
  typeName: string;
  actorId: string;
  userName: string;
}

export interface NotifyRecipientSummary {
  count: number;
  recipientIds: string[];
}

export interface NotificationPort {
  createNotification(input: CreateNotificationInput): Promise<unknown>;
  createManyNotifications(inputs: CreateNotificationInput[]): Promise<unknown>;
  listNotifications(userId: string, unreadOnly?: boolean): Promise<unknown[]>;
  getUnreadCount(userId: string): Promise<number>;
  markAsRead(id: string, userId: string): Promise<unknown>;
  markAllAsRead(userId: string): Promise<unknown>;
  deleteNotification(id: string, userId: string): Promise<unknown>;
  notifyUserCreated(input: NotifyUserCreatedInput): Promise<NotifyRecipientSummary>;
  notifyUserDeactivated(input: NotifyUserDeactivatedInput): Promise<NotifyRecipientSummary>;
  notifyDocumentUploaded(input: NotifyDocumentUploadedInput): Promise<NotifyRecipientSummary>;
  notifyRosterAlert(input: NotifyRosterAlertInput): Promise<NotifyRecipientSummary>;
}