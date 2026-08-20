import { CategoryModel } from "../../Models/Category.model.js";
import { ProductModel } from "../../Models/Product.model.js"
import { validarNuevoProducto, validarProductoActualizacion } from "../../Services/Product.service.js";
import { AppError } from "../../Models/Error.model.js";
import { base_path, url } from "../../Config/Env.js";
import { CartModel } from "../../Models/Cart.model.js";
import { FileModel } from "../../Models/File.model.js";
import { obtenerCsrfToken, esPeticionAjax, validarCsrfToken } from "../../Helpers.js";
import { validateFile } from "secure-file-validator";
import { MAX_PRODUCT_IMAGES, MAX_PRODUCT_IMAGE_SIZE } from "../../Middleware/Upload.middleware.js";
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
        message: status >= 500 ? fallbackMessage : error.message
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

const normalizeFileIds = (value) => {
    const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
    const ids = values.map(Number);

    if (ids.some((id) => !Number.isInteger(id) || id < 1)) {
        throw new AppError('Bad Request', 'La seleccion de imagenes no es valida', 400);
    }

    return [...new Set(ids)];
};

const removeStoredProductFiles = async (files, productId) => {
    const directory = productUploadDirectory(productId);

    await Promise.all(files.map(async (file) => {
        const filename = path.basename(file.nombre || '');

        if (!filename) return;

        const filePath = path.resolve(directory, filename);

        if (path.dirname(filePath) !== directory) {
            throw new AppError('Internal Server Error', 'Ruta de imagen de producto invalida', 500);
        }

        try {
            await fs.unlink(filePath);
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
        }
    }));
};

const validateProductImages = async (files) => {
    if (!Array.isArray(files) || files.length === 0) {
        return;
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
};

const storeProductImages = async (files, productId) => {
    if (!Array.isArray(files) || files.length === 0) {
        return [];
    }

    const directory = productUploadDirectory(productId);
    await fs.mkdir(directory, { recursive: true });
    const storedPaths = [];

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
            storedPaths.push(destination);

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
        await Promise.all(storedPaths.map(async (storedPath) => {
            try {
                await fs.unlink(storedPath);
            } catch (cleanupError) {
                if (cleanupError.code !== 'ENOENT') {
                    console.error('No se pudo limpiar una imagen nueva:', cleanupError);
                }
            }
        }));
        throw error;
    }
};

const validateAndStoreProductImages = async (files, productId) => {
    await validateProductImages(files);
    return storeProductImages(files, productId);
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
                product_message:productMessage,
            })
        } catch (error) {
            return next(error);
        }
    }

    async product(req, res, next){
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


    async edit(req, res, next){
        const id = Number(req.params?.id ?? req.query?.id);

        try {
            if (!Number.isInteger(id) || id < 1) {
                throw new AppError('Bad Request', 'Id de producto invalido', 400);
            }

            const producto = await this.#productModel.findByID(id);

            if (!producto) {
                throw new AppError('Not Found', 'Producto inexistente', 404);
            }

            const [variantes, imagenes, talles, categorias] = await Promise.all([
                this.#productModel.findVariants(producto),
                this.#fileModel.findByProductId(producto.id),
                this.#productModel.getTalles(),
                this.#categoryController.getAll()
            ]);
            const productMessage = consumeProductMessage(req);
            const storedFormData = req.session?.product_update_form_data || {};
            const formData = String(storedFormData.id || '') === String(id)
                ? storedFormData
                : {};

            if (req.session?.product_update_form_data) {
                delete req.session.product_update_form_data;
            }

            res.set('Cache-Control', 'no-store');

            return res.status(200).render('admin/edit', {
                title:`Editar ${producto.nombre}`,
                user:req.session.user,
                producto,
                variantes,
                imagenes,
                talles,
                categorias,
                url,
                baseUrl:base_path(),
                csrf_token:obtenerCsrfToken(req),
                product_message:productMessage,
                form_data:formData
            });
        } catch (error) {
            const status = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
            const message = productErrorMessage(
                error,
                'No se pudo abrir la edicion del producto. Intenta nuevamente.'
            );

            if (status >= 500) {
                console.error('Error interno al abrir la edicion de un producto:', error);
            }

            if (esPeticionAjax(req)) {
                return res.status(status).json({
                    data:null,
                    error:status >= 500 ? 'Internal Server Error' : error?.error || 'Request Error',
                    message:message.message,
                    status,
                    redirectTo:url('/admin/productos')
                });
            }

            req.session.product_message = message;

            try {
                await saveSession(req);
            } catch (sessionError) {
                return next(sessionError);
            }

            return res.redirect(303, url('/admin/productos'));
        }
    }


    async update(req, res, next){
        const id = Number(req.body?.id);
        const editUrl = Number.isInteger(id) && id > 0
            ? url(`/admin/producto/edit/${id}`)
            : url('/admin/productos');
        const submittedFormData = {
            id:req.body?.id,
            variante_id:req.body?.variante_id,
            nombre:req.body?.nombre,
            descripcion:req.body?.descripcion,
            talle:req.body?.talle,
            stock:req.body?.stock,
            precio:req.body?.precio,
            categoria:req.body?.categoria,
            eliminar_imagenes:req.body?.eliminar_imagenes
        };
        let productExists = false;
        let storedImages = [];
        let insertedImages = [];

        try {
            if (!Number.isInteger(id) || id < 1) {
                throw new AppError('Bad Request', 'Id de producto invalido', 400);
            }

            const existingProduct = await this.#productModel.findByID(id);

            if (!existingProduct) {
                throw new AppError('Not Found', 'Producto inexistente', 404);
            }

            productExists = true;

            if (!validarCsrfToken(req)) {
                throw new AppError('Forbidden', 'CSRF token invalido', 403);
            }

            const producto = validarProductoActualizacion(req.body);

            if (producto.categoria !== undefined) {
                const categoria = await this.#categoryController.findByID(producto.categoria);

                if (!categoria) {
                    throw new AppError('Bad Request', 'La categoria seleccionada no existe', 400);
                }

                producto.categoria = categoria.id;
            }

            if (producto.talle !== undefined) {
                const talle = await this.#productModel.findSizeByID(producto.talle);

                if (!talle) {
                    throw new AppError('Bad Request', 'El talle seleccionado no existe', 400);
                }
            }

            const variantIdValue = req.body?.variante_id;
            const variantId = variantIdValue === undefined || variantIdValue === ''
                ? null
                : Number(variantIdValue);

            if (variantId !== null && (!Number.isInteger(variantId) || variantId < 1)) {
                throw new AppError('Bad Request', 'Id de variante invalido', 400);
            }

            if (variantId !== null) {
                await this.#productModel.findVariantByID(id, variantId);
            }

            const currentImages = await this.#fileModel.findByProductId(id);
            const imageIdsToDelete = normalizeFileIds(req.body?.eliminar_imagenes);
            const imagesToDelete = await this.#fileModel.findByIdsForProduct(id, imageIdsToDelete);

            if (imagesToDelete.length !== imageIdsToDelete.length) {
                throw new AppError('Bad Request', 'Una imagen seleccionada no pertenece al producto', 400);
            }

            const receivedFiles = Array.isArray(req.files) ? req.files : [];
            const finalImageCount = currentImages.length - imagesToDelete.length + receivedFiles.length;

            if (finalImageCount > MAX_PRODUCT_IMAGES) {
                throw new AppError(
                    'Bad Request',
                    `Se permiten hasta ${MAX_PRODUCT_IMAGES} imagenes por producto`,
                    400
                );
            }

            await validateProductImages(receivedFiles);
            await this.#productModel.update(id, producto);

            const variantData = {
                talle:producto.talle,
                stock:producto.stock,
                precio:producto.precio
            };
            const hasVariantChanges = Object.values(variantData).some((value) => value !== undefined);

            if (hasVariantChanges && variantId !== null) {
                await this.#productModel.updateVariant(id, variantId, variantData);
            } else if (hasVariantChanges) {
                if (variantData.talle === undefined) {
                    throw new AppError('Bad Request', 'El talle es obligatorio para crear la variante', 400);
                }

                await this.#productModel.createVariant(id, {
                    talle:variantData.talle,
                    stock:variantData.stock ?? existingProduct.stock,
                    precio:variantData.precio ?? existingProduct.precio
                });
            }

            storedImages = await storeProductImages(receivedFiles, id);
            insertedImages = await this.#fileModel.createMany(id, storedImages);

            if (imagesToDelete.length > 0) {
                await this.#fileModel.deleteMany(id, imageIdsToDelete);
                await removeStoredProductFiles(imagesToDelete, id).catch((fileError) => {
                    console.error('No se pudo eliminar una imagen del disco:', fileError);
                });
            }

            const response = {
                data:{
                    ...producto,
                    imagenes_agregadas:insertedImages,
                    imagenes_eliminadas:imageIdsToDelete
                },
                id,
                message:'Producto actualizado con exito',
                redirectTo:editUrl
            };

            if (esPeticionAjax(req)) {
                return res.status(200).json(response);
            }

            req.session.product_message = {
                type:'success',
                message:response.message
            };
            await saveSession(req);

            return res.redirect(303, response.redirectTo);
        } catch (error) {
            if (insertedImages.length > 0) {
                try {
                    await this.#fileModel.deleteMany(id, insertedImages.map((image) => image.id));
                } catch (rollbackError) {
                    console.error('No se pudieron revertir los registros de imagenes nuevas:', rollbackError);
                }
            }

            if (storedImages.length > 0) {
                try {
                    await removeStoredProductFiles(storedImages, id);
                } catch (rollbackError) {
                    console.error('No se pudieron revertir las imagenes nuevas:', rollbackError);
                }
            }

            const receivedStatus = error?.statusCode;
            const status = Number.isInteger(receivedStatus)
                && receivedStatus >= 400
                && receivedStatus <= 599
                ? receivedStatus
                : 500;
            const publicMessage = status >= 500
                ? 'No se pudo actualizar el producto. Intenta nuevamente.'
                : error.message;
            const redirectTo = productExists ? editUrl : url('/admin/productos');

            if (status >= 500) {
                console.error('Error interno al actualizar un producto:', error);
            }

            if (esPeticionAjax(req)) {
                return res.status(status).json({
                    data:null,
                    error:status >= 500 ? 'Internal Server Error' : error?.error || 'Request Error',
                    message:publicMessage,
                    status,
                    redirectTo
                });
            }

            req.session.product_message = productErrorMessage(
                error,
                'No se pudo actualizar el producto. Intenta nuevamente.'
            );

            if (productExists) {
                req.session.product_update_form_data = submittedFormData;
            }

            try {
                await saveSession(req);
            } catch (sessionError) {
                return next(sessionError);
            }

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
