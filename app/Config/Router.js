import { Router } from 'express';
import { authController } from '../Controllers/Auth.controller.js';
import { isAdmin, requireAuth } from '../Middleware/Session.middleware.js';
import { productController } from '../Controllers/Product.controller.js';
import { categoryController } from '../Controllers/Category.controller.js';

export const router = Router();

// router.get('/registro', authController.login.bind(authController));
router.get('/login', authController.showLogin.bind(authController));
router.post('/login', authController.login.bind(authController));

router.post('/registro', authController.register.bind(authController));
router.post('/logout', requireAuth, authController.logout.bind(authController));
// router.post('/login');

router.get('/productos', productController.getAll.bind(productController));
router.get('/producto/:id', productController.getByID.bind(productController));
router.post('/productos/crear', isAdmin, productController.create.bind(productController));
router.patch('/productos/actualizar', isAdmin, productController.update.bind(productController));
router.delete('/productos/eliminar', isAdmin, productController.delete.bind(productController));

router.get('/categorias', categoryController.getAll.bind(categoryController));
router.post('/categorias/crear', isAdmin, categoryController.create.bind(categoryController));
router.patch('/categorias/actualizar', isAdmin, categoryController.update.bind(categoryController));
router.delete('/categorias/eliminar', isAdmin, categoryController.delete.bind(categoryController));