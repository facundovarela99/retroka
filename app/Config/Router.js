import { Router } from 'express';
import { authController } from '../Controllers/Auth.controller.js';
import { isAdmin, requireAuth } from '../Middleware/Session.middleware.js';
import { productController } from '../Controllers/Product.controller.js';
import { categoryController } from '../Controllers/Category.controller.js';
import { cartController } from '../Controllers/Cart.Controller.js';
import { authRateLimit, requireCsrf } from '../Middleware/Auth.middleware.js';

export const router = Router();

// router.get('/registro', authController.login.bind(authController));
router.get('/login', authController.showLogin.bind(authController));
router.post('/login', authRateLimit('login'), authController.login.bind(authController));

router.get('/registro', authController.showRegister.bind(authController));
router.post('/registro', authRateLimit('register'), authController.register.bind(authController));
router.post('/logout', requireAuth, requireCsrf, authController.logout.bind(authController));
// router.post('/login');

router.get('/', productController.getAll.bind(productController));
router.get('/productos', productController.getAll.bind(productController));
router.get('/producto/:id', productController.product.bind(productController));
router.post('/productos/crear', isAdmin, requireCsrf, productController.create.bind(productController));
router.patch('/productos/actualizar', isAdmin, requireCsrf, productController.update.bind(productController));
router.delete('/productos/eliminar', isAdmin, requireCsrf, productController.delete.bind(productController));

router.get('/categorias', categoryController.getAll.bind(categoryController));
router.post('/categorias/crear', isAdmin, requireCsrf, categoryController.create.bind(categoryController));
router.patch('/categorias/actualizar', isAdmin, requireCsrf, categoryController.update.bind(categoryController));
router.delete('/categorias/eliminar', isAdmin, requireCsrf, categoryController.delete.bind(categoryController));


router.get('/carrito', requireAuth, cartController.getCart.bind(cartController));
router.post('/carrito/crear', requireAuth, requireCsrf, cartController.create.bind(cartController));
router.post('/carrito/agregar', requireAuth, requireCsrf, cartController.update.bind(cartController));
router.post('/carrito/remover', requireAuth, requireCsrf, cartController.remove.bind(cartController));
router.delete('/carrito/vaciar', requireAuth, requireCsrf, cartController.delete.bind(cartController));
