import { CategoryModel } from "../Models/Category.model.js";
import { ProductModel } from "../Models/Product.model.js"
import { validarNuevoProducto, validarProductoActualizacion } from "../Services/Product.service.js";
import { AppError } from "../Models/Error.model.js";



export class ProductController{

    #productModel
    #categoryController

    constructor(){
        this.#productModel = new ProductModel();
        this.#categoryController = new CategoryModel();
    }

    async getAll(req, res){
        try {
            const productos = await this.#productModel.getAll();
            res.status(200).json({
                data:productos,
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
            console.log('Errlr al crear producto: ', error);
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
            console.log('error: ', error)
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