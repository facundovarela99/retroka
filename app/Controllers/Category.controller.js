import { CategoryModel } from "../Models/Category.model.js";
import { AppError } from "../Models/Error.model.js";
import { validarCategoria } from "../Services/Category.service.js";


class CategoryController{
    #categoryModel;

    constructor(){
        this.#categoryModel = new CategoryModel;
    }

    async getAll(req, res){
        try{
            const categorias = await this.#categoryModel.getAll();
            res.status(200).json({
                data:categorias
            })
        }catch(error){
            res.status(error.statusCode).json({
                error:error.error,
                message: error.message
            })
        }
    }

    async create(req, res){
        try {
            const categoria = validarCategoria(req.body);
            const resultado = await this.#categoryModel.create(categoria);

            res.status(201).json({
                data:resultado,
                message:'Categoría creada exitosamente',
            })
        } catch (error) {
            res.status(error.statusCode).json({
                data:null,
                error: error.error,
                message:error.message
            })
        }
    }

    async update(req, res){
        const id = req.body.id;
    
        try {
            if (!id) throw new AppError('Not Found', 'Categoría inexistente', 404);
    
            if (await this.#categoryModel.findByID(id) === undefined) {
                throw new AppError('Not Found', 'Categoría inexistente', 404);
            }

            const categoria = validarCategoria(req.body).nombre;
            console.log('Cateogoria update: ', categoria);
            await this.#categoryModel.update(id, categoria);

            res.status(200).json({
                data:categoria,
                id:id,
                message:'Categoría actualizada con éxito'
            })

        } catch (error) {
            res.status(error.statusCode).json({
                data:null,
                error: error.error,
                message:error.message
            })
        }
    }

    async delete(req, res){
        const id = req.body.id;
        
        if (!id) throw new AppError('Not Found', 'Categoría inexistente', 404);

        try {
            await this.#categoryModel.delete(id);
            res.status(200).json({
                message:'Cateogoría elimianda exitosamente'
            })
        } catch (error) {
            res.status(error.statusCode).json({
                data:null,
                error: error.error,
                message:error.message
            })
        }
    }
}

export const categoryController = new CategoryController();