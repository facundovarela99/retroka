import { CategoryModel } from "../../Models/Category.model.js";
import { ProductModel } from "../../Models/Product.model.js"
import { validarNuevoProducto, validarProductoActualizacion } from "../../Services/Product.service.js";
import { AppError } from "../../Models/Error.model.js";
import { base_path, url } from "../../Config/Env.js";
import { CartModel } from "../../Models/Cart.model.js";
import { FileModel } from "../../Models/File.model.js";
import { VariantModel } from "../../Models/Variant.model.js";
import {
    validarActualizacionVariante,
    validarNuevaVariante
} from "../../Services/Variant.service.js";
import { obtenerCsrfToken, esPeticionAjax, validarCsrfToken, sessionMessage, getSessionMessage } from "../../Helpers.js";
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

const consumeVariantFormData = (req, productId, variantId = null) => {
    const storedFormData = req.session?.variant_form_data || {};

    if (req.session?.variant_form_data) {
        delete req.session.variant_form_data;
    }

    const belongsToProduct = String(storedFormData.producto_id || '') === String(productId);
    const belongsToVariant = variantId === null
        || String(storedFormData.variante_id || '') === String(variantId);

    return belongsToProduct && belongsToVariant ? storedFormData : {};
};

const validateMatchingId = (routeId, submittedValue, fieldName) => {
    if (submittedValue === undefined) return;

    const submittedId = Number(submittedValue);

    if (!Number.isInteger(submittedId) || submittedId < 1 || submittedId !== routeId) {
        throw new AppError('Bad Request', `${fieldName} no coincide con la ruta solicitada`, 400);
    }
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

const variantUploadDirectory = (productId, variantId) => {
    if (!Number.isInteger(Number(variantId)) || Number(variantId) < 1) {
        throw new AppError('Internal Server Error', 'Id de variante invalido para almacenar imagenes', 500);
    }

    const variantsRoot = path.resolve(productUploadDirectory(productId), 'variants');
    const directory = path.resolve(variantsRoot, String(variantId));

    if (path.dirname(directory) !== variantsRoot) {
        throw new AppError('Internal Server Error', 'Directorio de imagenes de variante invalido', 500);
    }

    return directory;
};

const removeVariantUploadDirectory = async (productId, variantId) => {
    const directory = variantUploadDirectory(productId, variantId);
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

const removeStoredVariantFiles = async (files, productId, variantId) => {
    const directory = variantUploadDirectory(productId, variantId);

    await Promise.all(files.map(async (file) => {
        const filename = path.basename(file.nombre || '');

        if (!filename) return;

        const filePath = path.resolve(directory, filename);

        if (path.dirname(filePath) !== directory) {
            throw new AppError('Internal Server Error', 'Ruta de imagen de variante invalida', 500);
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

const storeVariantImages = async (files, productId, variantId) => {
    if (!Array.isArray(files) || files.length === 0) {
        return [];
    }

    const directory = variantUploadDirectory(productId, variantId);
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
                url:`/uploads/${productId}/variants/${variantId}/${filename}`,
                nombre:filename,
                nombre_original:path.basename(file.originalname.replaceAll('\\', '/')),
                mime_type:mimeType,
                size:file.size
            });
        }

        return storedFiles;
    } catch (error) {
        await Promise.all(storedPaths.map(async (storedPath) => {
            try {
                await fs.unlink(storedPath);
            } catch (cleanupError) {
                if (cleanupError.code !== 'ENOENT') {
                    console.error('No se pudo limpiar una imagen nueva de variante:', cleanupError);
                }
            }
        }));
        throw error;
    }
};

export class ProductController{

    #productModel
    #categoryController
    #cartModel
    #fileModel
    #variantModel

    constructor(){
        this.#productModel = new ProductModel();
        this.#categoryController = new CategoryModel();
        this.#cartModel = new CartModel();
        this.#fileModel = new FileModel();
        this.#variantModel = new VariantModel();
    }

    async #respondVariantError(req, res, next, error, options){
        const receivedStatus = error?.statusCode;
        const status = Number.isInteger(receivedStatus)
            && receivedStatus >= 400
            && receivedStatus <= 599
            ? receivedStatus
            : 500;
        const message = productErrorMessage(error, options.fallbackMessage);

        if (status >= 500) {
            console.error(options.logMessage, error);
        }

        if (esPeticionAjax(req)) {
            return res.status(status).json({
                data:null,
                error:status >= 500 ? 'Internal Server Error' : error?.error || 'Request Error',
                message:message.message,
                status,
                redirectTo:options.redirectTo
            });
        }

        req.session.product_message = message;

        if (options.formData) {
            req.session.variant_form_data = options.formData;
        }

        try {
            await saveSession(req);
        } catch (sessionError) {
            return next(sessionError);
        }

        return res.redirect(303, options.redirectTo);
    }

    async index(req, res, next){
        try {
            const user = req.session.user;
            const productos = await this.#productModel.getAll();
            const productosEliminados = await this.#productModel.getAllDeleted();
            const productMessage = getSessionMessage(req);

            res.status(200).render('admin/products/products',{
                user:user,
                title: 'Productos',
                productos,
                productos_eliminados:productosEliminados,
                url:url,
                baseUrl:base_path(),
                csrf_token:obtenerCsrfToken(req),
                product_message:productMessage,
            })
        } catch (error) {
            console.log('Ocurrió un error jodido...', error);
            return next(error);
        }
    }

    async product(req, res, next){
        const id = req.params.id;

        try {
            const user = req.session.user;

            const producto = await this.#productModel.findByID(id);

            if (!producto){
                sessionMessage(req, 'Producto inexistente', 'danger');
                return res.redirect(303, url('/admin/productos'));
            }

            const [variantes, imagenes] = await Promise.all([
                this.#productModel.findVariants(producto),
                this.#fileModel.findByProductId(producto.id)
            ]);
            const variantesConImagenes = variantes.map((variante) => ({
                ...variante,
                imagenes:imagenes.filter(
                    (imagen) => Number(imagen.variante_id) === Number(variante.variante_id)
                )
            }));

            const productMessage = getSessionMessage(req);
            const updateFormData = req.session?.product_update_form_data || {};

            if (req.session?.product_update_form_data) {
                delete req.session.product_update_form_data;
            }

            res.status(200).render('admin/products/product', {
                user:user,
                title:producto.nombre,
                producto:producto,
                variantes:variantesConImagenes,
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

            return res.render('admin/products/create', {
                title:'Crear producto',
                user:req.session.user,
                url:url,
                csrf_token: obtenerCsrfToken(req),
                categorias: await this.#categoryController.getAll(),
                product_message:productMessage,
                form_data:formData
            });
        } catch (error) {
            return next(error);
        }
    }

    async store(req, res, next){
        let formData = null;

        try{
            formData = {
                nombre: req.body.nombre,
                descripcion: req.body.descripcion,
                categoria: req.body.categoria,
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

            sessionMessage(req, 'Producto creado exitosamente', 'success');

            if (esPeticionAjax(req)) {
                return res.status(201).json({
                    data:result,
                    message: 'Producto creado exitosamente',
                    redirectTo: url('/admin/productos')
                });
            }

            return res.redirect(303, url('/admin/productos'));
        } catch(error){
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

    async createVariant(req, res, next){
        const productId = Number(req.params?.productId);
        const productUrl = Number.isInteger(productId) && productId > 0
            ? url(`/admin/productos/${productId}`)
            : url('/admin/productos');
        let productExists = false;

        try {
            if (!Number.isInteger(productId) || productId < 1) {
                throw new AppError('Bad Request', 'Id de producto invalido', 400);
            }

            const producto = await this.#productModel.findByID(productId);

            if (!producto) {
                sessionMessage(req, 'Producto inexistente', 'danger');
                return res.redirect(303, url('/admin/productos'));
            }

            productExists = true;

            const [talles, variantes] = await Promise.all([
                this.#variantModel.getSizes(),
                this.#variantModel.findByProductId(productId)
            ]);
            const productMessage = consumeProductMessage(req);
            const formData = consumeVariantFormData(req, productId);

            res.set('Cache-Control', 'no-store');

            return res.status(200).render('admin/variant/create', {
                title:`Nueva variante de ${producto.nombre}`,
                user:req.session.user,
                producto,
                variantes,
                talles,
                url,
                baseUrl:base_path(),
                csrf_token:obtenerCsrfToken(req),
                product_message:productMessage,
                form_data:formData
            });
        } catch (error) {
            return this.#respondVariantError(req, res, next, error, {
                fallbackMessage:'No se pudo abrir la creacion de la variante. Intenta nuevamente.',
                logMessage:'Error interno al abrir la creacion de una variante:',
                redirectTo:productExists ? productUrl : url('/admin/productos')
            });
        }
    }

    async storeVariant(req, res, next){
        const productId = Number(req.params?.productId);
        const productUrl = Number.isInteger(productId) && productId > 0
            ? url(`/admin/productos/${productId}`)
            : url('/admin/productos');
        const createUrl = Number.isInteger(productId) && productId > 0
            ? url(`/admin/productos/${productId}/variantes/nueva`)
            : url('/admin/productos');
        const formData = {
            producto_id:req.body?.producto_id,
            talle:req.body?.talle,
            color:req.body?.color,
            stock:req.body?.stock,
            precio:req.body?.precio
        };
        let productExists = false;
        let createdVariant = null;
        let storedImages = [];
        let insertedImages = [];

        try {
            if (!Number.isInteger(productId) || productId < 1) {
                throw new AppError('Bad Request', 'Id de producto invalido', 400);
            }

            validateMatchingId(productId, req.body?.producto_id, 'El producto');

            const producto = await this.#productModel.findByID(productId);

            if (!producto) {
                throw new AppError('Not Found', 'Producto inexistente', 404);
            }

            productExists = true;

            if (!validarCsrfToken(req)) {
                throw new AppError('Forbidden', 'CSRF token invalido', 403);
            }

            const receivedFiles = Array.isArray(req.files) ? req.files : [];
            await validateProductImages(receivedFiles);

            const variante = validarNuevaVariante({
                ...req.body,
                producto_id:productId
            });
            console.log('variante validada: ', variante);
            const talle = await this.#variantModel.findSizeByID(variante.talle);

            if (!talle) {
                throw new AppError('Bad Request', 'El talle seleccionado no existe', 400);
            }

            const result = await this.#variantModel.create(productId, variante);
            createdVariant = result;
            const currentImages = await this.#fileModel.findByVariantId(productId, result.id);

            if (currentImages.length + receivedFiles.length > MAX_PRODUCT_IMAGES) {
                throw new AppError(
                    'Bad Request',
                    `Se permiten hasta ${MAX_PRODUCT_IMAGES} imagenes por variante`,
                    400
                );
            }

            storedImages = await storeVariantImages(receivedFiles, productId, result.id);
            insertedImages = await this.#fileModel.createManyForVariant(
                productId,
                result.id,
                storedImages
            );
            const response = {
                data:{
                    ...result,
                    talle:talle.tipo,
                    imagenes:insertedImages
                },
                message:'Variante creada exitosamente',
                status:201,
                redirectTo:productUrl
            };

            if (esPeticionAjax(req)) {
                return res.status(201).json(response);
            }

            req.session.product_message = {
                type:'success',
                message:response.message
            };
            await saveSession(req);

            return res.redirect(303, productUrl);
        } catch (error) {
            if (insertedImages.length > 0 && createdVariant) {
                try {
                    await this.#fileModel.deleteManyForVariant(
                        productId,
                        createdVariant.id,
                        insertedImages.map((image) => image.id)
                    );
                } catch (rollbackError) {
                    console.error('No se pudieron revertir las imagenes registradas de la variante:', rollbackError);
                }
            }

            if (storedImages.length > 0 && createdVariant) {
                try {
                    await removeStoredVariantFiles(storedImages, productId, createdVariant.id);
                } catch (rollbackError) {
                    console.error('No se pudieron revertir los archivos de la variante:', rollbackError);
                }
            }

            if (createdVariant) {
                try {
                    await this.#variantModel.softDelete(productId, createdVariant.id);
                } catch (rollbackError) {
                    console.error('No se pudo revertir la variante creada:', rollbackError);
                }
            }

            return this.#respondVariantError(req, res, next, error, {
                fallbackMessage:'No se pudo crear la variante. Intenta nuevamente.',
                logMessage:'Error interno al crear una variante:',
                redirectTo:productExists ? createUrl : url('/admin/productos'),
                formData:productExists ? formData : null
            });
        }
    }

    async editVariant(req, res, next){
        const productId = Number(req.params?.productId);
        const variantId = Number(req.params?.variantId);
        const productUrl = Number.isInteger(productId) && productId > 0
            ? url(`/admin/productos/${productId}`)
            : url('/admin/productos');
        let productExists = false;

        try {
            if (!Number.isInteger(productId) || productId < 1) {
                throw new AppError('Bad Request', 'Id de producto invalido', 400);
            }

            if (!Number.isInteger(variantId) || variantId < 1) {
                throw new AppError('Bad Request', 'Id de variante invalido', 400);
            }

            const producto = await this.#productModel.findByID(productId);

            if (!producto) {
                sessionMessage(req, 'Producto inexistente', 'danger');
                return res.redirect(303, url('/admin/productos'));
            }

            productExists = true;

            const [variante, talles, variantes, imagenes] = await Promise.all([
                this.#variantModel.findByID(productId, variantId),
                this.#variantModel.getSizes(),
                this.#variantModel.findByProductId(productId),
                this.#fileModel.findByVariantId(productId, variantId)
            ]);
            const productMessage = consumeProductMessage(req);
            const formData = consumeVariantFormData(req, productId, variantId);

            res.set('Cache-Control', 'no-store');

            return res.status(200).render('admin/variant/edit', {
                title:`Editar variante de ${producto.nombre}`,
                user:req.session.user,
                producto,
                variante,
                variantes,
                imagenes,
                talles,
                url,
                baseUrl:base_path(),
                csrf_token:obtenerCsrfToken(req),
                product_message:productMessage,
                form_data:formData
            });
        } catch (error) {
            return this.#respondVariantError(req, res, next, error, {
                fallbackMessage:'No se pudo abrir la edicion de la variante. Intenta nuevamente.',
                logMessage:'Error interno al abrir la edicion de una variante:',
                redirectTo:productExists ? productUrl : url('/admin/productos')
            });
        }
    }

    async updateVariant(req, res, next){
        const productId = Number(req.params?.productId);
        const variantId = Number(req.params?.variantId);
        const productUrl = Number.isInteger(productId) && productId > 0
            ? url(`/admin/productos/${productId}`)
            : url('/admin/productos');
        const editUrl = Number.isInteger(productId) && productId > 0
            && Number.isInteger(variantId) && variantId > 0
            ? url(`/admin/productos/${productId}/variantes/${variantId}/editar`)
            : productUrl;
        const formData = {
            producto_id:req.body?.producto_id,
            variante_id:req.body?.variante_id,
            talle:req.body?.talle,
            color:req.body?.color,
            stock:req.body?.stock,
            precio:req.body?.precio,
            eliminar_imagenes:req.body?.eliminar_imagenes
        };
        let productExists = false;
        let variantExists = false;
        let storedImages = [];
        let insertedImages = [];

        try {
            if (!Number.isInteger(productId) || productId < 1) {
                throw new AppError('Bad Request', 'Id de producto invalido', 400);
            }

            if (!Number.isInteger(variantId) || variantId < 1) {
                throw new AppError('Bad Request', 'Id de variante invalido', 400);
            }

            validateMatchingId(productId, req.body?.producto_id, 'El producto');
            validateMatchingId(variantId, req.body?.variante_id, 'La variante');

            const producto = await this.#productModel.findByID(productId);

            if (!producto) {
                throw new AppError('Not Found', 'Producto inexistente', 404);
            }

            productExists = true;

            await this.#variantModel.findByID(productId, variantId);
            variantExists = true;

            if (!validarCsrfToken(req)) {
                throw new AppError('Forbidden', 'CSRF token invalido', 403);
            }

            const receivedFiles = Array.isArray(req.files) ? req.files : [];
            await validateProductImages(receivedFiles);

            const currentImages = await this.#fileModel.findByVariantId(productId, variantId);
            const imageIdsToDelete = normalizeFileIds(req.body?.eliminar_imagenes);
            const imagesToDelete = await this.#fileModel.findVariantFilesByIds(
                productId,
                variantId,
                imageIdsToDelete
            );

            if (imagesToDelete.length !== imageIdsToDelete.length) {
                throw new AppError('Bad Request', 'Una imagen seleccionada no pertenece a la variante', 400);
            }

            const finalImageCount = currentImages.length - imagesToDelete.length + receivedFiles.length;

            if (finalImageCount > MAX_PRODUCT_IMAGES) {
                throw new AppError(
                    'Bad Request',
                    `Se permiten hasta ${MAX_PRODUCT_IMAGES} imagenes por variante`,
                    400
                );
            }

            const variante = validarActualizacionVariante(req.body);

            if (variante.talle !== undefined) {
                const talle = await this.#variantModel.findSizeByID(variante.talle);

                if (!talle) {
                    throw new AppError('Bad Request', 'El talle seleccionado no existe', 400);
                }
            }

            const result = await this.#variantModel.update(productId, variantId, variante);
            storedImages = await storeVariantImages(receivedFiles, productId, variantId);
            insertedImages = await this.#fileModel.createManyForVariant(
                productId,
                variantId,
                storedImages
            );

            if (imageIdsToDelete.length > 0) {
                await this.#fileModel.deleteManyForVariant(productId, variantId, imageIdsToDelete);
                await removeStoredVariantFiles(imagesToDelete, productId, variantId).catch((fileError) => {
                    console.error('No se pudieron eliminar archivos antiguos de la variante:', fileError);
                });
            }

            const response = {
                data:{
                    ...result,
                    imagenes_agregadas:insertedImages,
                    imagenes_eliminadas:imageIdsToDelete
                },
                message:'Variante actualizada exitosamente',
                status:200,
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

            return res.redirect(303, editUrl);
        } catch (error) {
            if (insertedImages.length > 0) {
                try {
                    await this.#fileModel.deleteManyForVariant(
                        productId,
                        variantId,
                        insertedImages.map((image) => image.id)
                    );
                } catch (rollbackError) {
                    console.error('No se pudieron revertir las imagenes nuevas de la variante:', rollbackError);
                }
            }

            if (storedImages.length > 0) {
                try {
                    await removeStoredVariantFiles(storedImages, productId, variantId);
                } catch (rollbackError) {
                    console.error('No se pudieron revertir los archivos nuevos de la variante:', rollbackError);
                }
            }

            const redirectTo = productExists && variantExists ? editUrl : productUrl;

            return this.#respondVariantError(req, res, next, error, {
                fallbackMessage:'No se pudo actualizar la variante. Intenta nuevamente.',
                logMessage:'Error interno al actualizar una variante:',
                redirectTo:productExists ? redirectTo : url('/admin/productos'),
                formData:productExists && variantExists ? formData : null
            });
        }
    }

    async deleteVariant(req, res, next){
        const productId = Number(req.params?.productId);
        const variantId = Number(req.params?.variantId);
        const productUrl = Number.isInteger(productId) && productId > 0
            ? url(`/admin/productos/${productId}`)
            : url('/admin/productos');
        let productExists = false;

        try {
            if (!Number.isInteger(productId) || productId < 1) {
                throw new AppError('Bad Request', 'Id de producto invalido', 400);
            }

            if (!Number.isInteger(variantId) || variantId < 1) {
                throw new AppError('Bad Request', 'Id de variante invalido', 400);
            }

            validateMatchingId(productId, req.body?.producto_id, 'El producto');
            validateMatchingId(variantId, req.body?.variante_id, 'La variante');

            const producto = await this.#productModel.findByID(productId);

            if (!producto) {
                throw new AppError('Not Found', 'Producto inexistente', 404);
            }

            productExists = true;

            await this.#variantModel.findByID(productId, variantId);

            if (!validarCsrfToken(req)) {
                throw new AppError('Forbidden', 'CSRF token invalido', 403);
            }

            await this.#variantModel.hardDelete(productId, variantId);
            await removeVariantUploadDirectory(productId, variantId);

            const response = {
                data:{ id:variantId, producto_id:productId },
                message:'Variante eliminada exitosamente',
                status:200,
                redirectTo:productUrl
            };
            
            if (esPeticionAjax(req)) {
                return res.status(200).json(response);
            }

            sessionMessage(req, 'Variante eliminada exitosamente', 'success');
            return res.redirect(303, url('/admin/productos/' + productId));
        } catch (error) {
            return this.#respondVariantError(req, res, next, error, {
                fallbackMessage:'No se pudo eliminar la variante. Intenta nuevamente.',
                logMessage:'Error interno al eliminar una variante:',
                redirectTo:productExists ? productUrl : url('/admin/productos')
            });
        }
    }


    async edit(req, res, next){
        const id = Number(req.params?.id ?? req.query?.id);

        try {
            if (!Number.isInteger(id) || id < 1) {
                throw new AppError('Bad Request', 'Id de producto invalido', 400);
            }

            const producto = await this.#productModel.findByID(id);

            if (!producto){
                sessionMessage(req, 'Producto inexistente', 'danger');
                return res.redirect(303, url('/admin/productos'));
            }

            const categorias = await this.#categoryController.getAll();
            const productMessage = consumeProductMessage(req);
            const storedFormData = req.session?.product_update_form_data || {};
            const formData = String(storedFormData.id || '') === String(id)
                ? storedFormData
                : {};

            if (req.session?.product_update_form_data) {
                delete req.session.product_update_form_data;
            }

            res.set('Cache-Control', 'no-store');

            return res.status(200).render('admin/products/edit', {
                title:`Editar ${producto.nombre}`,
                user:req.session.user,
                producto,
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
            nombre:req.body?.nombre,
            descripcion:req.body?.descripcion,
            categoria:req.body?.categoria
        };
        let productExists = false;

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

            await this.#productModel.update(id, producto);

            const response = {
                data:producto,
                id,
                message:'Producto actualizado con exito',
                redirectTo:editUrl
            };

            if (esPeticionAjax(req)) {
                return res.status(200).json(response);
            }

            sessionMessage(req, 'Producto actualizado exitosamente', 'success');
            return res.redirect(303, url('/admin/productos'));
        } catch (error) {
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

            if (!this.#productModel.findByID(id)){
                if (esPeticionAjax(req)) {
                    return res.status(404).json({message:'Producto inexistente'});
                }
                req.session.product_message = {
                    type: 'success',
                    message: response.message
                };
                await saveSession(req);
                return res.redirect(404, 'admin/productos');
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

    async publish(req, res, next){
        const id = req.body.id;
        const categoria = req.body.categoria;
        console.log(id);
        console.log(await this.#productModel.findByID(1000));

        if (!validarCsrfToken(req)){
            if (esPeticionAjax(req)){
                return res.status(409).json({
                    status:'error',
                    error: 'Forbidden',
                    message:'Token inválido, debe reiniciar la sesión.'
                })
            }
            sessionMessage(req, 'Token inválido, debe reiniciar la sesión', 'danger');
            return res.redirect(303, url('/admin/productos'));
        }

        if (!await this.#productModel.findByID(id)){
            if (esPeticionAjax(req)){
                return res.status(404).json({
                    type:'error',
                    message:'Producto inexistente'
                });
            }

            sessionMessage(req, 'Producto inexistente', 'danger');
            return res.redirect(303, url('/admin/productos'));
        }

        try {
            await this.#productModel.publish(id, categoria);

            if (esPeticionAjax(req)){
                return res.status(200).json({
                    type:'success',
                    message:'Producto publicado exitosamente'
                });
            }

            sessionMessage(req, 'Token inválido, debe reiniciar la sesión', 'danger');
            return res.redirect(303, url('/admin/productos'));
        } catch (error) {
            return next(error);
        }

    }
}

export const productController = new ProductController();
