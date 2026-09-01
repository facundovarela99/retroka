import { Router } from 'express';
import { authController } from '../Controllers/Auth.controller.js';
import { isAdmin, requireAuth } from '../Middleware/Session.middleware.js';
import { productController as adminProductController } from '../Controllers/admin/Product.controller.js';
import { productController as siteProductController } from '../Controllers/site/Product.controller.js';
import { categoryController } from '../Controllers/admin/Category.controller.js';
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
router.get('/admin', requireAuth, isAdmin, dashboardController.index.bind(dashboardController));
router.get('/admin/dashboard', requireAuth, isAdmin, dashboardController.index.bind(dashboardController));

//Productos
router.get('/admin/productos', requireAuth, isAdmin, adminProductController.index.bind(adminProductController));
router.get('/admin/productos/nuevo', requireAuth, isAdmin, adminProductController.create.bind(adminProductController));
router.get('/admin/productos/:id', requireAuth, isAdmin, adminProductController.product.bind(adminProductController));
router.get('/admin/producto/edit/:id', requireAuth, isAdmin, adminProductController.edit.bind(adminProductController));
router.get('/admin/producto/edit', requireAuth, isAdmin, adminProductController.edit.bind(adminProductController));
router.post('/admin/productos/crear', requireAuth, isAdmin, requireCsrf, adminProductController.store.bind(adminProductController));
router.post('/admin/productos/actualizar', requireAuth, isAdmin, requireCsrf, adminProductController.update.bind(adminProductController));
router.patch('/admin/productos/actualizar', requireAuth, isAdmin, requireCsrf, adminProductController.update.bind(adminProductController));
router.post('/admin/productos/eliminar', requireAuth, isAdmin, requireCsrf, adminProductController.delete.bind(adminProductController));
router.post('/admin/productos/publicar', requireAuth, isAdmin, adminProductController.publish.bind(adminProductController));

//Variantes
router.get('/admin/productos/:productId/variantes/nueva', requireAuth, isAdmin, adminProductController.createVariant.bind(adminProductController));
router.post('/admin/productos/:productId/variantes', requireAuth, isAdmin, uploadProductImages, handleProductUploadError, adminProductController.storeVariant.bind(adminProductController));
router.get('/admin/productos/:productId/variantes/:variantId/editar', requireAuth, isAdmin, adminProductController.editVariant.bind(adminProductController));
router.post('/admin/productos/:productId/variantes/:variantId', requireAuth, isAdmin, uploadProductImages, handleProductUploadError, adminProductController.updateVariant.bind(adminProductController));
router.patch('/admin/productos/:productId/variantes/:variantId', requireAuth, isAdmin, uploadProductImages, handleProductUploadError, adminProductController.updateVariant.bind(adminProductController));
router.post('/admin/productos/:productId/variantes/:variantId/eliminar', requireAuth, isAdmin, adminProductController.deleteVariant.bind(adminProductController));
router.delete('/admin/productos/:productId/variantes/:variantId', requireAuth, isAdmin, adminProductController.deleteVariant.bind(adminProductController));

//Categorías
router.get('/admin/categorias', isAdmin, categoryController.index.bind(categoryController));
router.get('/admin/categoria/:id', isAdmin, categoryController.edit.bind(categoryController));
router.get('/admin/categorias/crear', isAdmin, categoryController.create.bind(categoryController));
router.post('/admin/categorias/guardar', isAdmin, requireCsrf, categoryController.store.bind(categoryController));
router.patch('/admin/categorias/actualizar', isAdmin, requireCsrf, categoryController.update.bind(categoryController));
router.post('/admin/categorias/eliminar', isAdmin, requireCsrf, categoryController.delete.bind(categoryController));

//       -------------RUTAS SITIO-------------       //

router.get('/', siteProductController.index.bind(siteProductController));
router.get('/productos', siteProductController.index.bind(siteProductController));
router.get('/producto/:id', siteProductController.product.bind(siteProductController));


// router.get('/categorias', categoryController.getAll.bind(categoryController));
// router.get('/categoria/:id', categoryController.getAll.bind(categoryController));
// router.post('/categorias/crear', isAdmin, requireCsrf, categoryController.create.bind(categoryController));
// router.patch('/categorias/actualizar', isAdmin, requireCsrf, categoryController.update.bind(categoryController));
// router.delete('/categorias/eliminar', isAdmin, requireCsrf, categoryController.delete.bind(categoryController));


router.get('/carrito', requireAuth, cartController.getCart.bind(cartController));
router.post('/carrito/crear', requireAuth, requireCsrf, cartController.create.bind(cartController));
router.post('/carrito/agregar', requireAuth, requireCsrf, cartController.update.bind(cartController));
router.post('/carrito/remover', requireAuth, requireCsrf, cartController.remove.bind(cartController));
router.delete('/carrito/vaciar', requireAuth, requireCsrf, cartController.delete.bind(cartController));
