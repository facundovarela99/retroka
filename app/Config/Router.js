import { Router } from 'express';
import { authController } from '../Controllers/Auth.controller.js';
import { isAdmin, requireAuth } from '../Middleware/Session.middleware.js';
import { productController as adminProductController } from '../Controllers/admin/Product.controller.js';
import { productController as siteProductController } from '../Controllers/site/Product.controller.js';
import { categoryController } from '../Controllers/Category.controller.js';
import { cartController } from '../Controllers/Cart.Controller.js';
import { authRateLimit, requireCsrf } from '../Middleware/Auth.middleware.js';
import { handleProductUploadError, uploadProductImages } from '../Middleware/Upload.middleware.js';
import { dashboardController } from '../Controllers/admin/Dashboard.controller.js';

export const router = Router();


// Autenticación
router.get('/login', authController.showLogin.bind(authController));
router.post('/login', authRateLimit('login'), authController.login.bind(authController));

router.get('/registro', authController.showRegister.bind(authController));
router.post('/registro', authRateLimit('register'), authController.register.bind(authController));
router.post('/logout', requireAuth, requireCsrf, authController.logout.bind(authController));

//       -------------RUTAS ADMIN-------------       //

//Dashboard
router.get('/admin/dashboard', requireAuth, isAdmin, dashboardController.index.bind(dashboardController));

//Productos
router.get('/admin/productos', requireAuth, isAdmin, adminProductController.getAll.bind(adminProductController));
router.get('/admin/productos/nuevo', requireAuth, isAdmin, adminProductController.create.bind(adminProductController));
router.get('/admin/productos/:id', requireAuth, isAdmin, adminProductController.edit.bind(adminProductController));
router.post('/admin/productos/crear', requireAuth, isAdmin, uploadProductImages, handleProductUploadError, requireCsrf, adminProductController.store.bind(adminProductController));
router.patch('/admin/productos/actualizar', requireAuth, isAdmin, requireCsrf, adminProductController.update.bind(adminProductController));
router.post('/admin/productos/eliminar', requireAuth, isAdmin, requireCsrf, adminProductController.delete.bind(adminProductController));

//       -------------RUTAS SITIO-------------       //

router.get('/', siteProductController.getAll.bind(siteProductController));
router.get('/productos', siteProductController.getAll.bind(siteProductController));
router.get('/producto/:id', siteProductController.product.bind(siteProductController));


router.get('/categorias', categoryController.getAll.bind(categoryController));
router.post('/categorias/crear', isAdmin, requireCsrf, categoryController.create.bind(categoryController));
router.patch('/categorias/actualizar', isAdmin, requireCsrf, categoryController.update.bind(categoryController));
router.delete('/categorias/eliminar', isAdmin, requireCsrf, categoryController.delete.bind(categoryController));


router.get('/carrito', requireAuth, cartController.getCart.bind(cartController));
router.post('/carrito/crear', requireAuth, requireCsrf, cartController.create.bind(cartController));
router.post('/carrito/agregar', requireAuth, requireCsrf, cartController.update.bind(cartController));
router.post('/carrito/remover', requireAuth, requireCsrf, cartController.remove.bind(cartController));
router.delete('/carrito/vaciar', requireAuth, requireCsrf, cartController.delete.bind(cartController));
