import { Router } from 'express';
import authRouter from './auth.routes';
import usersRouter from './users.routes';
import templatesRouter from './templates.routes';
import requestsRouter from './requests.routes';
import notificationsRouter from './notifications.routes';
import auditRouter from './audit.routes';
import dashboardRouter from './dashboard.routes';
import settingsRouter from './settings.routes';
import filesRouter from './files.routes';
import registrationsRouter from './registrations.routes';
import departmentsRouter from './departments.routes';
import permissionsRouter from './permissions.routes';

const router = Router();

router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/admin/registrations', registrationsRouter);
router.use('/templates', templatesRouter);
router.use('/requests', requestsRouter);
router.use('/notifications', notificationsRouter);
router.use('/audit', auditRouter);
router.use('/dashboard', dashboardRouter);
router.use('/settings', settingsRouter);
router.use('/files', filesRouter);
router.use('/departments', departmentsRouter);
router.use('/permissions', permissionsRouter);

export default router;
