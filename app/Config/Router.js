import { Router } from 'express';
import { authController } from '../Controllers/Auth.controller.js';
import { requireAuth } from '../Middleware/Session.middleware.js';

export const router = Router();

// router.get('/registro');
router.post('/login', authController.login.bind(authController));

router.post('/registro', authController.register.bind(authController));
router.post('/logout', requireAuth, authController.logout.bind(authController));
// router.post('/login');

