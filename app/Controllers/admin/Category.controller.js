import { CategoryModel } from "../../Models/Category.model.js";
import { AppError } from "../../Models/Error.model.js";
import { validarCategoria } from "../../Services/Category.service.js";
import { base_path, url } from "../../Config/Env.js";
import { obtenerCsrfToken, esPeticionAjax, sessionMessage, getSessionMessage } from "../../Helpers.js";

const saveSession = (req) => new Promise((resolve, reject) => {
    req.session.save((error) => {
        if (error) return reject(error);
        return resolve();
    });
});

class CategoryController{
    #categoryModel;

    constructor(){
        this.#categoryModel = new CategoryModel;
    }

    async index(req, res, next){
        const categoryMessage = getSessionMessage(req);
        console.log('index categorías')

        try{
            const categorias = await this.#categoryModel.getAll();
            
            if (esPeticionAjax(req)){
                return res.status(200).json(categorias);
            }

            res.status(200).render('admin/categories/index',{
                title:'Categorias',
                categorias:categorias,
                url:url,
                baseUrl:base_path(),
                category_message:categoryMessage,
                csrf_token:obtenerCsrfToken(req),
            })
        }catch(error){
            return next(error);
        }
    }

    async edit(req, res){
        const id = req.params.id;

        const category = this.#categoryModel.findByID(id);

        const categoryMessage = getSessionMessage(req);

        if (!category){
            req.session.category_message = this.#categoryErrorMessage(
                error,
                'Categoría inexistente.'
            );
            this.index(req, res);
        }

        res.status(200).render('admin/categories/edit', {
            title:category.nombre,
            url:url,
            baseUrl:base_path(),
            category_message:categoryMessage,
        })
    }

    async create(req, res){

        const categoryMessage = getSessionMessage(req);

        res.status(200).render('admin/categories/create', {
            title:'Nueva categoría',
            url:url,
            baseUrl:base_path(),
            category_message:categoryMessage,
            csrf_token:obtenerCsrfToken(req),
        })
    }
    
    async store(req, res, next){
        try {
            const categoria = validarCategoria(req.body);
            const resultado = await this.#categoryModel.create(categoria);
            const message = 'Categoría creada exitosamente';

            sessionMessage(req, message, 'success');
            await saveSession(req);

            if (esPeticionAjax(req)) {
                return res.status(201).json({
                    data:resultado,
                    message,
                    redirectTo:url('/admin/categorias')
                });
            }

            return res.redirect(303, url('/admin/categorias'));

        } catch (error) {
            if (esPeticionAjax(req)){
                return res.status(error.statusCode || 500).json({
                    data:null,
                    error: error.error || 'Internal Server Error',
                    message:error.message || 'Error al crear la categoría'
                });
            }

            sessionMessage(
                req,
                error.message || 'Error al crear la categoría',
                'error'
            );

            try {
                await saveSession(req);
            } catch (sessionError) {
                return next(sessionError);
            }

            return res.redirect(303, url('/admin/categorias/crear'));
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
            const relatedProducts = await this.#categoryModel.getRelatedProducts(id);
            if (relatedProducts.length > 0){
                if (esPeticionAjax(req)){
                    return res.status(409).json({
                        status:'error',
                        error: 'Conflict',
                        message:'La categoría tiene productos asociados'
                    })
                }
                sessionMessage(req, 'La categoría tiene productos asociados', 'danger');
                return res.redirect(303, url('/admin/categorias'));
            }

            await this.#categoryModel.delete(id);

            if (esPeticionAjax(req)){
                return res.status(200).json({
                    message:'Cateogoría elimianda exitosamente'
                });
            }

            sessionMessage(req, 'Categoría eliminada exitosamente', 'success');

            return res.status(200).render('admin/categories/index',{
                title:'Categorias',
                categorias:categorias,
                url:url,
                baseUrl:base_path(),
                category_message:categoryMessage,
                csrf_token:obtenerCsrfToken(req),
            });
            
        } catch (error) {
            if (esPeticionAjax(req)){
                return res.status(error.statusCode || 500).json({
                    data:null,
                    error: error.error || 'Internal Server Error',
                    message:error.message || 'Error al eliminar la categoría'
                })
            }
            sessionMessage(req, 'Error al eliminar la categoría', 'danger');
            return res.redirect(303, url('/admin/categorias'));
        }
    }

    async #categoryErrorMessage(error, fallbackMessage){
        const status = Number.isInteger(error?.statusCode) ? error.statusCode : 500;

        return {
            type: 'error',
            message: status >= 500 ? fallbackMessage : error.message
        };
    };
}

export const categoryController = new CategoryController();
