import { getDb } from '../database/connection';
import { sseService } from './sse.service';
import type { Notification, NotificationType } from '@req-tracker/shared';

interface CreateNotificationParams {
  userId: number;
  requestId?: number | null;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string | null;
}

export function createNotification(params: CreateNotificationParams): Notification {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO notifications (user_id, request_id, type, title, message, action_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    params.userId,
    params.requestId ?? null,
    params.type,
    params.title,
    params.message,
    params.actionUrl ?? null,
  );

  const notification = db.prepare('SELECT * FROM notifications WHERE id = ?').get(result.lastInsertRowid) as Notification;

  // Push via SSE
  sseService.pushToUser(params.userId, 'notification', notification);

  return notification;
}

export function getNotificationsForUser(userId: number, page = 1, perPage = 20): { notifications: Notification[]; total: number } {
  const db = getDb();
  const offset = (page - 1) * perPage;

  const total = (db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ?').get(userId) as { count: number }).count;

  const notifications = db.prepare(`
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(userId, perPage, offset) as Notification[];

  return { notifications, total };
}

export function getUnreadCount(userId: number): number {
  const db = getDb();
  return (db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0').get(userId) as { count: number }).count;
}

export function markAsRead(notificationId: number, userId: number): void {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(notificationId, userId);
}

export function markAllAsRead(userId: number): void {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').run(userId);
}
