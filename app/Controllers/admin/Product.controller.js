import { CategoryModel } from "../../Models/Category.model.js";
import { ProductModel } from "../../Models/Product.model.js"
import { validarNuevoProducto, validarProductoActualizacion } from "../../Services/Product.service.js";
import { AppError } from "../../Models/Error.model.js";
import { base_path, url } from "../../Config/Env.js";
import { CartModel } from "../../Models/Cart.model.js";
import { FileModel } from "../../Models/File.model.js";
import { obtenerCsrfToken, esPeticionAjax } from "../../Helpers.js";
import { validateFile } from "secure-file-validator";
import { MAX_PRODUCT_IMAGE_SIZE } from "../../Middleware/Upload.middleware.js";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PRODUCT_UPLOADS_ROOT = path.resolve(__dirname, '../../../public/uploads');
const MIME_TYPE_BY_EXTENSION = new Map([
    ['.jpg', 'image/jpeg'],
    ['.jpeg', 'image/jpeg'],
    ['.png', 'image/png'],
    ['.gif', 'image/gif'],
    ['.svg', 'image/svg+xml']
]);

const consumeProductMessage = (req) => {
    const message = req.session?.product_message || null;

    if (req.session?.product_message) {
        delete req.session.product_message;
    }

    return message;
};

const productErrorMessage = (error, fallbackMessage) => {
    const status = Number.isInteger(error?.statusCode) ? error.statusCode : 500;

    return {
        type: 'error',
        message: status >= 500 ? fallbackMessage : error.message,
        ...(process.env.NODE_ENV !== 'production' && error?.stack
            ? { details: error.stack }
            : {})
    };
};

const saveSession = (req) => new Promise((resolve, reject) => {
    req.session.save((error) => {
        if (error) return reject(error);
        return resolve();
    });
});

const productUploadDirectory = (productId) => {
    if (!Number.isInteger(Number(productId)) || Number(productId) < 1) {
        throw new AppError('Internal Server Error', 'Id de producto invalido para almacenar imagenes', 500);
    }

    const directory = path.resolve(PRODUCT_UPLOADS_ROOT, String(productId));

    if (path.dirname(directory) !== PRODUCT_UPLOADS_ROOT) {
        throw new AppError('Internal Server Error', 'Directorio de imagenes invalido', 500);
    }

    return directory;
};

const removeProductUploadDirectory = async (productId) => {
    const directory = productUploadDirectory(productId);
    await fs.rm(directory, { recursive: true, force: true });
};

const validateAndStoreProductImages = async (files, productId) => {
    if (!Array.isArray(files) || files.length === 0) {
        return [];
    }

    for (const file of files) {
        const validation = await validateFile(file.path, {
            maxSizeInBytes: MAX_PRODUCT_IMAGE_SIZE
        });

        if (!validation.status) {
            throw new AppError(
                'Bad Request',
                `La imagen ${file.originalname} no es valida: ${validation.message}`,
                400
            );
        }
    }

    const directory = productUploadDirectory(productId);
    await fs.mkdir(directory, { recursive: true });

    try {
        const storedFiles = [];

        for (const file of files) {
            const filename = path.basename(file.filename);
            const extension = path.extname(filename).toLowerCase();
            const mimeType = MIME_TYPE_BY_EXTENSION.get(extension);

            if (!mimeType) {
                throw new AppError('Bad Request', `Formato de imagen no permitido: ${file.originalname}`, 400);
            }

            const destination = path.join(directory, filename);
            await fs.rename(file.path, destination);

            storedFiles.push({
                url: `/uploads/${productId}/${filename}`,
                nombre: filename,
                nombre_original: path.basename(file.originalname.replaceAll('\\', '/')),
                mime_type: mimeType,
                size: file.size
            });
        }

        return storedFiles;
    } catch (error) {
        await removeProductUploadDirectory(productId);
        throw error;
    }
};


export class ProductController{

    #productModel
    #categoryController
    #cartModel
    #fileModel

    constructor(){
        this.#productModel = new ProductModel();
        this.#categoryController = new CategoryModel();
        this.#cartModel = new CartModel();
        this.#fileModel = new FileModel();
    }

    async getAll(req, res, next){
        try {
            const user = req.session.user;
            const productos = await this.#productModel.getAll();
            const productMessage = consumeProductMessage(req);
            var carritoUsuario = [];

            if (user){
                carritoUsuario = await this.#cartModel.getUserCart(user.id);
            }

            res.status(200).render('admin/productos',{
                user:user,
                title: 'Productos',
                productos:productos,
                carrito:carritoUsuario,
                url:url,
                baseUrl:base_path(),
                csrf_token:obtenerCsrfToken(req),
                product_message:productMessage
            })
        } catch (error) {
            return next(error);
        }
    }

    async edit(req, res, next){
        const id = req.params.id;

        try {
            const user = req.session.user;
        
            if (!id) throw new AppError('Not Found', 'Producto inexistente', 404);
        
            const producto = await this.#productModel.findByID(id);
            const [variantes, imagenes] = await Promise.all([
                this.#productModel.findVariants(producto),
                this.#fileModel.findByProductId(producto.id)
            ]);
            const productMessage = consumeProductMessage(req);
            const updateFormData = req.session?.product_update_form_data || {};

            if (req.session?.product_update_form_data) {
                delete req.session.product_update_form_data;
            }

            var carritoUsuario = []

            if (user){
                carritoUsuario = await this.#cartModel.getUserCart(user.id);
            }

            res.status(200).render('admin/producto', {
                user:user,
                title:producto.nombre,
                producto:producto,
                variantes:variantes,
                imagenes:imagenes,
                carrito:carritoUsuario,
                url:url,
                baseUrl:base_path(),
                csrf_token:obtenerCsrfToken(req),
                product_message:productMessage,
                update_form_data:updateFormData
            })

        } catch (error) {
            return next(error);
        }
    }

    async create(req, res, next){
        try {
            const productMessage = consumeProductMessage(req);
            const formData = req.session?.product_form_data || {};

            if (req.session?.product_form_data) {
                delete req.session.product_form_data;
            }

            return res.render('admin/create', {
                title:'Crear producto',
                user:req.session.user,
                url:url,
                csrf_token: obtenerCsrfToken(req),
                talles: await this.#productModel.getTalles(),
                categorias: await this.#categoryController.getAll(),
                product_message:productMessage,
                form_data:formData
            });
        } catch (error) {
            return next(error);
        }
    }

    async store(req, res, next){
        let createdProductId = null;
        let formData = null;

        try{
            formData = {
                nombre: req.body.nombre,
                descripcion: req.body.descripcion,
                talle: req.body.talle,
                stock: req.body.stock,
                precio: req.body.precio,
                categoria: req.body.categoria,
                imagenes: []
            };

            const producto = validarNuevoProducto(formData);

            if (req.body.categoria){
                const categoria = await this.#categoryController.findByID(req.body.categoria);

                if (!categoria) {
                    throw new AppError('Bad Request', 'La categoria seleccionada no existe', 400);
                }

                producto.categoria = categoria.id;
            }

            const result = await this.#productModel.create(producto);
            createdProductId = result.id;

            const storedImages = await validateAndStoreProductImages(req.files, result.id);
            const productWithImages = validarNuevoProducto({
                ...producto,
                imagenes: storedImages.map((file) => file.url)
            });
            const insertedImages = await this.#fileModel.createMany(result.id, storedImages);

            req.session.product_message = {
                type: 'success',
                message: 'Producto creado exitosamente'
            };

            await saveSession(req);

            if (esPeticionAjax(req)) {
                return res.status(201).json({
                    data: {
                        ...result,
                        imagenes: insertedImages,
                        urls: productWithImages.imagenes
                    },
                    message: 'Producto creado exitosamente',
                    redirectTo: url('/admin/productos')
                });
            }

            return res.redirect(303, url('/admin/productos'));
        } catch(error){
            console.error(error);
            if (createdProductId) {
                try {
                    await removeProductUploadDirectory(createdProductId);
                    await this.#productModel.delete(createdProductId);
                } catch (rollbackError) {
                    console.error('No se pudo revertir el producto luego de un error de imagenes:', rollbackError);
                }
            }

            const status = Number.isInteger(error?.statusCode) ? error.statusCode : 500;

            if (esPeticionAjax(req)) {
                return next(error);
            }

            if (status >= 500) {
                console.error('Error interno al crear un producto:', error);
            }

            req.session.product_message = productErrorMessage(
                error,
                'No se pudo crear el producto. Intenta nuevamente.'
            );
            req.session.product_form_data = formData;

            try {
                await saveSession(req);
            } catch (sessionError) {
                return next(sessionError);
            }

            return res.redirect(303, url('/admin/productos/nuevo'));
        }
    }


    async update(req, res, next){
        const id = Number(req.body.id);

        try {

            if (!Number.isInteger(id) || id < 1) {
                throw new AppError('Bad Request', 'Id de producto invalido', 400);
            }
        
            await this.#productModel.findByID(id);

            const producto = validarProductoActualizacion(req.body);

            if (req.body.categoria !== undefined && req.body.categoria !== '') {
                const categoria = await this.#categoryController.findByID(req.body.categoria);

                if (!categoria) {
                    throw new AppError('Bad Request', 'La categoria seleccionada no existe', 400);
                }

                producto.categoria = categoria.id;
            }

            if (Object.keys(producto).length === 0) {
                throw new AppError('Bad Request', 'No hay campos para actualizar', 400);
            }

            // Logica para actualizar las imágenes
            // ......
            // Logica para actualizar las imágenes

            await this.#productModel.update(id, producto);

            const response = {
                data:producto,
                id:id,
                message:'Producto actualizado con exito',
                redirectTo:url('/admin/productos/' + id)
            };

            if (esPeticionAjax(req)) {
                return res.status(200).json(response);
            }

            req.session.product_message = {
                type: 'success',
                message: response.message
            };
            await saveSession(req);

            return res.redirect(303, response.redirectTo);
        } catch (error) {
            if (esPeticionAjax(req)) {
                return next(error);
            }

            const status = Number.isInteger(error?.statusCode) ? error.statusCode : 500;

            if (status >= 500) {
                console.error('Error interno al actualizar un producto:', error);
            }

            req.session.product_message = productErrorMessage(
                error,
                'No se pudo actualizar el producto. Intenta nuevamente.'
            );
            req.session.product_update_form_data = req.body;

            try {
                await saveSession(req);
            } catch (sessionError) {
                return next(sessionError);
            }

            const redirectTo = Number.isInteger(id) && id > 0 && status !== 404
                ? url('/admin/productos/' + id)
                : url('/admin/productos');

            return res.redirect(303, redirectTo);
        }
    }

    async delete(req, res, next){
        const id = Number(req.body?.id);

        try {
            if (!Number.isInteger(id) || id < 1) {
                throw new AppError('Bad Request', 'Id de producto invalido', 400);
            }

            await this.#productModel.findByID(id);
            await this.#productModel.delete(id);

            const response = {
                id,
                message:'Producto eliminado exitosamente',
                redirectTo:url('/admin/productos')
            };

            if (esPeticionAjax(req)) {
                return res.status(200).json(response);
            }

            req.session.product_message = {
                type: 'success',
                message: response.message
            };

            try {
                await saveSession(req);
            } catch (sessionError) {
                return next(sessionError);
            }

            return res.redirect(303, response.redirectTo);
        } catch(error) {
            const receivedStatus = error?.statusCode;
            const status = Number.isInteger(receivedStatus)
                && receivedStatus >= 400
                && receivedStatus <= 599
                ? receivedStatus
                : 500;

            if (process.env.NODE_ENV !== 'production' || status >= 500) {
                console.error('Error al eliminar un producto:', error);
            }

            if (esPeticionAjax(req)) {
                return next(error);
            }

            req.session.product_message = productErrorMessage(
                error,
                'No se pudo eliminar el producto. Intenta nuevamente.'
            );

            try {
                await saveSession(req);
            } catch (sessionError) {
                return next(sessionError);
            }

            return res.redirect(303, url('/admin/productos'));
        }
    }
}

export const productController = new ProductController();
