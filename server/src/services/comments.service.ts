import { getDb } from '../database/connection';
import { createAuditEntry } from './audit.service';
import { createNotification } from './notifications.service';
import { getRequestById } from './requests.service';
import type { Comment, CreateCommentPayload } from '@req-tracker/shared';

export function getComments(requestId: number): Comment[] {
  const db = getDb();
  const comments = db.prepare(`
    SELECT c.*, u.display_name as user_name
    FROM comments c
    JOIN users u ON u.id = c.user_id
    WHERE c.request_id = ?
    ORDER BY c.created_at ASC
  `).all(requestId) as Comment[];

  // Build thread tree
  const topLevel: Comment[] = [];
  const byId = new Map<number, Comment>();

  for (const c of comments) {
    c.replies = [];
    byId.set(c.id, c);
  }

  for (const c of comments) {
    if (c.parent_id && byId.has(c.parent_id)) {
      byId.get(c.parent_id)!.replies!.push(c);
    } else {
      topLevel.push(c);
    }
  }

  return topLevel;
}

export function addComment(requestId: number, userId: number, payload: CreateCommentPayload): Comment {
  const db = getDb();
  const request = getRequestById(requestId);

  const result = db.prepare(`
    INSERT INTO comments (request_id, user_id, parent_id, body, is_internal)
    VALUES (?, ?, ?, ?, ?)
  `).run(requestId, userId, payload.parent_id ?? null, payload.body, payload.is_internal ? 1 : 0);

  const comment = db.prepare(`
    SELECT c.*, u.display_name as user_name
    FROM comments c
    JOIN users u ON u.id = c.user_id
    WHERE c.id = ?
  `).get(result.lastInsertRowid) as Comment;

  createAuditEntry({
    entityType: 'comment',
    entityId: comment.id,
    requestId,
    action: 'commented',
    newValue: payload.body.substring(0, 200),
    performedBy: userId,
    metadata: { is_internal: payload.is_internal },
  });

  // Notify requester (if commenter is not the requester)
  if (request && request.submitted_by !== userId) {
    const commenter = db.prepare('SELECT display_name FROM users WHERE id = ?').get(userId) as { display_name: string };
    createNotification({
      userId: request.submitted_by,
      requestId,
      type: 'comment_added',
      title: 'New Comment',
      message: `${commenter.display_name} commented on request ${request.reference_number}: "${payload.body.substring(0, 100)}"`,
      actionUrl: `/requests/${requestId}`,
    });
  }

  return comment;
}
