import { getDb } from '../database/connection';
import { getOverduePendingActions, updateNotifiedAt } from '../repositories/pendingActions.repository';
import { logger } from '../config/logger';

let escalationInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Check for overdue pending actions and send reminders/escalations.
 * - Under escalation threshold: send reminder to assigned user
 * - Over escalation threshold: escalate (log for now, email when SMTP is configured)
 */
export function checkOverdueActions(): void {
  const db = getDb();

  // Get escalation settings
  const reminderHoursSetting = db.prepare(
    "SELECT value FROM system_settings WHERE key = 'escalation_reminder_hours'"
  ).get() as { value: string } | undefined;
  const reminderHours = reminderHoursSetting ? parseInt(reminderHoursSetting.value, 10) : 4;

  const overdue = getOverduePendingActions();

  for (const pa of overdue) {
    if (!pa.due_by) continue;

    const dueAt = new Date(pa.due_by).getTime();
    const now = Date.now();
    const hoursPastDue = (now - dueAt) / (1000 * 60 * 60);

    // Skip if we already notified recently (within 1 hour)
    if (pa.notified_at) {
      const lastNotified = new Date(pa.notified_at).getTime();
      const hoursSinceNotification = (now - lastNotified) / (1000 * 60 * 60);
      if (hoursSinceNotification < 1) continue;
    }

    if (hoursPastDue < reminderHours) {
      // Send reminder to assigned user
      logger.info({
        pendingActionId: pa.id,
        assignedTo: pa.assigned_to,
        requestRef: pa.request_reference,
        hoursPastDue: Math.round(hoursPastDue * 10) / 10,
      }, 'Sending overdue reminder');

      // Create in-app notification
      try {
        db.prepare(`
          INSERT INTO notifications (user_id, request_id, type, title, message, action_url)
          VALUES (?, ?, 'reminder', ?, ?, ?)
        `).run(
          pa.assigned_to,
          pa.request_id,
          `Overdue: ${pa.step_name} needed`,
          `Request ${pa.request_reference} is past its SLA deadline and needs your ${pa.required_permission?.toLowerCase() ?? 'action'}.`,
          `/requests/${pa.request_id}`
        );
      } catch (e) {
        logger.error({ error: e }, 'Failed to create reminder notification');
      }

      updateNotifiedAt(pa.id);
    } else {
      // Escalate — for now, create a high-priority notification
      logger.warn({
        pendingActionId: pa.id,
        assignedTo: pa.assigned_to,
        requestRef: pa.request_reference,
        hoursPastDue: Math.round(hoursPastDue * 10) / 10,
      }, 'Escalating overdue action');

      try {
        db.prepare(`
          INSERT INTO notifications (user_id, request_id, type, title, message, action_url)
          VALUES (?, ?, 'escalation', ?, ?, ?)
        `).run(
          pa.assigned_to,
          pa.request_id,
          `Escalated: ${pa.step_name} overdue`,
          `Request ${pa.request_reference} has been overdue for ${Math.round(hoursPastDue)} hours. Immediate action required.`,
          `/requests/${pa.request_id}`
        );
      } catch (e) {
        logger.error({ error: e }, 'Failed to create escalation notification');
      }

      updateNotifiedAt(pa.id);
    }
  }
}

/**
 * Start the escalation check interval.
 */
export function startEscalationService(): void {
  if (escalationInterval) return;

  const db = getDb();
  const intervalSetting = db.prepare(
    "SELECT value FROM system_settings WHERE key = 'escalation_check_interval_minutes'"
  ).get() as { value: string } | undefined;
  const intervalMinutes = intervalSetting ? parseInt(intervalSetting.value, 10) : 15;

  escalationInterval = setInterval(() => {
    try {
      checkOverdueActions();
    } catch (e) {
      logger.error({ error: e }, 'Escalation check failed');
    }
  }, intervalMinutes * 60 * 1000);

  logger.info({ intervalMinutes }, 'Escalation service started');
}

/**
 * Stop the escalation check interval.
 */
export function stopEscalationService(): void {
  if (escalationInterval) {
    clearInterval(escalationInterval);
    escalationInterval = null;
    logger.info('Escalation service stopped');
  }
}
