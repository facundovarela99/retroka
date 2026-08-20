import { ProductModel } from '../../Models/Product.model.js';
import { CategoryModel } from '../../Models/Category.model.js';
import { url } from '../../Config/Env.js';
import { obtenerCsrfToken } from '../../Helpers.js';

class DashboardController {
    #productModel;
    #categoryModel;

    constructor() {
        this.#productModel = new ProductModel();
        this.#categoryModel = new CategoryModel();
    }

    async index(req, res, next) {
        try {
            const [productos, categorias] = await Promise.all([
                this.#productModel.getAll(),
                this.#getCategories()
            ]);
            const productosNormalizados = Array.isArray(productos) ? productos : [];
            const stockTotal = productosNormalizados.reduce((total, producto) => {
                const stock = Number.parseInt(producto.stock, 10);
                return total + (Number.isFinite(stock) ? Math.max(stock, 0) : 0);
            }, 0);
            const productosStockBajo = productosNormalizados
                .filter((producto) => {
                    const stock = Number.parseInt(producto.stock, 10);
                    return Number.isFinite(stock) && stock <= 5;
                })
                .sort((a, b) => Number(a.stock) - Number(b.stock))
                .slice(0, 8);

            return res.status(200).render('admin/dashboard', {
                title: 'Dashboard',
                user: req.session.user,
                productosNormalizados: productosNormalizados,
                url,
                csrf_token: obtenerCsrfToken(req),
                stats: {
                    productos: productosNormalizados.length,
                    stockTotal,
                    sinStock: productosNormalizados.filter((producto) => Number(producto.stock) <= 0).length,
                    categorias: categorias.length
                },
                productosStockBajo
            });
        } catch (error) {
            return next(error);
        }
    }

    async #getCategories() {
        try {
            const categorias = await this.#categoryModel.getAll();
            return Array.isArray(categorias) ? categorias : [];
        } catch (error) {
            if (error.statusCode === 404) return [];
            throw error;
        }
    }
}

export const dashboardController = new DashboardController();
