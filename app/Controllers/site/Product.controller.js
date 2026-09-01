import { ProductModel } from '../../Models/Product.model.js';
import { AppError } from '../../Models/Error.model.js';
import { base_path, url } from '../../Config/Env.js';
import { CartModel } from '../../Models/Cart.model.js';
import { FileService } from '../../Services/File.service.js';
import { obtenerCsrfToken } from '../../Helpers.js';
import { sessionMessage, getSessionMessage } from '../../Helpers.js';

export class ProductController {
    #productModel;
    #cartModel;
    #fileService;

    constructor(){
        this.#productModel = new ProductModel();
        this.#cartModel = new CartModel();
        this.#fileService = new FileService();
    }

    async index(req, res, next){
        try {
            const user = req.session.user;
            const productos = await this.#productModel.getAllForStore();
            const variantes = await this.#productModel.findStorefrontVariants(
                productos.map((producto) => producto.id)
            );
            const variantesPorProducto = new Map();

            for (const variante of variantes) {
                const productVariants = variantesPorProducto.get(variante.id) || [];
                productVariants.push(variante);
                variantesPorProducto.set(variante.id, productVariants);
            }

            const productosConVariantes = productos.map((producto) => ({
                ...producto,
                variantes:variantesPorProducto.get(producto.id) || []
            }));
            const carritoUsuario = user
                ? await this.#cartModel.getUserCart(user.id)
                : [];

            return res.status(200).render('site/productos', {
                user,
                title:'Productos',
                productos:productosConVariantes,
                carrito:carritoUsuario,
                url,
                baseUrl:base_path(),
                csrf_token:obtenerCsrfToken(req),
                product_message:getSessionMessage(req),
                auth_message:getSessionMessage(req)
            });
        } catch (error) {
            return next(error);
        }
    }

    async product(req, res, next){
        const id = Number(req.params?.id);

        try {
            if (!Number.isInteger(id) || id < 1) {
                throw new AppError('Not Found', 'Producto inexistente', 404);
            }

            const producto = await this.#productModel.findByID(id);
            const [variantes, imagenesProducto] = producto?.activo
                ? await Promise.all([
                    this.#productModel.findStorefrontVariants([id]),
                    this.#fileService.findByProductId(id)
                ])
                : [[], []];

            if (!producto || Number(producto.activo) !== 1 || variantes.length === 0) {
                sessionMessage(req, 'Producto inexistente', 'danger');
                return res.redirect(303, url('/productos'));
            }

            const variantesConImagenes = variantes.map((variante) => ({
                ...variante,
                imagenes: imagenesProducto
                    .filter((imagen) => Number(imagen.variante_id) === Number(variante.variante_id))
                    .map((imagen) => ({ ...imagen, url: imagen.url }))
            }));

            const talles = await this.#productModel.getTalles();

            const user = req.session.user;
            const carritoUsuario = user
                ? await this.#cartModel.getUserCart(user.id)
                : [];

            return res.status(200).render('site/producto', {
                user,
                title:producto.nombre,
                producto,
                variantes: variantesConImagenes,
                talles: talles,
                carrito:carritoUsuario,
                url,
                baseUrl:base_path(),
                csrf_token:obtenerCsrfToken(req)
            });
        } catch (error) {
            return next(error);
        }
    }
}

export const productController = new ProductController();
