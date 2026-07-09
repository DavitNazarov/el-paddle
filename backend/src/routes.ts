import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes.js';
import { categoriesRouter } from './modules/categories/categories.routes.js';
import { clubsRouter } from './modules/clubs/clubs.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { eventsRouter } from './modules/events/events.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { registrationsRouter } from './modules/registrations/registrations.routes.js';
import { usersRouter } from './modules/users/users.routes.js';

export const router = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(categoriesRouter);
router.use(eventsRouter);
router.use(dashboardRouter);
router.use(registrationsRouter);
router.use(clubsRouter);
router.use(usersRouter);
