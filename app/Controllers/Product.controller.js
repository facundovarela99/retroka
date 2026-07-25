import { CategoryModel } from "../Models/Category.model.js";
import { ProductModel } from "../Models/Product.model.js"
import { validarNuevoProducto, validarProductoActualizacion } from "../Services/Product.service.js";
import { AppError } from "../Models/Error.model.js";
import { base_path, url } from "../Config/Env.js";
import { CartModel } from "../Models/Cart.model.js";



export class ProductController{

    #productModel
    #categoryController
    #cartModel

    constructor(){
        this.#productModel = new ProductModel();
        this.#categoryController = new CategoryModel();
        this.#cartModel = new CartModel();
    }

    async getAll(req, res){
        try {
            const user = req.session.user;
            const productos = await this.#productModel.getAll();

            const carritoUsuario = this.#cartModel.getUserCart(user.id);

            res.status(200).render('productos',{
                user:user,
                title: 'Productos',
                productos:productos,
                carrito:carritoUsuario,
                url:url,
            })
        } catch (error) {
            res.status(error.statusCode).json({
                data:null,
                error:error.error,
                message:error.message,
            });
        }
    }

    async getByID(req, res){
        const id = req.params.id;
        
        try {
            if (!id) throw new AppError('Not Found', 'Producto inexistente', 404);
        
            const producto = await this.#productModel.findByID(id);

            res.status(200).render('producto', {
                title:producto.nombre,
                producto:producto,
            })

        } catch (error) {
            res.status(error.statusCode).json({
                data:null,
                error:error.error,
                message:error.message
            });
        }
    }

    //Solo para administrador
    async create(req, res){
        try{
            const producto = validarNuevoProducto(req.body);

            if (req.body.categoria){
                const categoria = await this.#categoryController.findByID(req.body.categoria).id;
                (categoria !== undefined) ? producto.categoria = categoria : producto.categoria = null;
            }

            const result = await this.#productModel.create(producto);
            // Logica para subir las imágenes
            // ......
            // Logica para subir las imágenes

            res.status(201).json({
                data:result,
                message:'Producto creado exitosamente'
            })
        } catch(error){
            res.status(error.statusCode).json({
                data:null,
                error:error.error,
                message:error.message
            });
        }
    }


    async update(req, res){
        const id = req.body.id;
        try {

            if (!id) throw new AppError('Not Found', 'Producto inexistente', 404);
        
            await this.#productModel.findByID(id);

            const producto = validarProductoActualizacion(req.body);

            if (req.body.categoria){
                
                const categoria = await this.#categoryController.findByID(req.body.categoria);
                const productoDeBase = this.#productModel.findByID(id);

                if (categoria !== undefined){
                    producto.categoria = categoria;
                } else if (productoDeBase.categoria !== null){
                    producto.categoria = productoDeBase.categoria;
                }
                
            }

            // Logica para actualizar las imágenes
            // ......
            // Logica para actualizar las imágenes

            await this.#productModel.update(id, producto);

            res.status(200).json({
                data:producto,
                id:id,
                message:'Producto actualizado con éxito'
            })
        } catch (error) {
            res.status(500).json({
                message: error.message
            })
        }
    }

    async delete(req, res){
        const id = req.body.id;
        try{

            await this.#productModel.findByID(id);

            await this.#productModel.delete(id);
            
            res.status(200).json({
                message:'Producto eliminado exitosamente'
            })
        } catch(error){
            res.status(error.statusCode).json({
                error:error.error,
                message: error.message
            })
        }
    }
}

export const productController = new ProductController();