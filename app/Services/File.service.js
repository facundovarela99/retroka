import { randomUUID } from 'crypto';
import { mkdirSync, promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { validateFile } from 'secure-file-validator';
import { url } from '../Config/Env.js';
import { esPeticionAjax } from '../Helpers.js';
import { FileModel } from '../Models/File.model.js';
import { AppError } from '../Models/Error.model.js';

export const MAX_PRODUCT_IMAGES = 8;
export const MAX_PRODUCT_IMAGE_SIZE = 5 * 1024 * 1024;

const TEMP_UPLOAD_DIRECTORY = path.join(os.tmpdir(), 'retroka-product-uploads');
const SERVICE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_UPLOADS_ROOT = path.resolve(SERVICE_DIRECTORY, '../../public/uploads');
const CLOUDINARY_FOLDER_ROOT = 'retroka/products';
const ALLOWED_IMAGE_TYPES = new Map([
    ['.jpg', new Set(['image/jpeg'])],
    ['.jpeg', new Set(['image/jpeg'])],
    ['.png', new Set(['image/png'])],
    ['.gif', new Set(['image/gif'])],
    ['.svg', new Set(['image/svg+xml'])]
]);

mkdirSync(TEMP_UPLOAD_DIRECTORY, { recursive:true });

export const getFileStorageDriver = (environment = process.env.NODE_ENV) => {
    const normalizedEnvironment = String(environment || 'development').trim().toLowerCase();

    return normalizedEnvironment === 'development' ? 'local' : 'cloudinary';
};

const normalizeOriginalName = (file) => path.basename(
    String(file?.originalname || '').replaceAll('\\', '/')
);

const validateFileMetadata = (file) => {
    const originalName = normalizeOriginalName(file);
    const extension = path.extname(originalName).toLowerCase();
    const acceptedMimeTypes = ALLOWED_IMAGE_TYPES.get(extension);
    const mimeType = String(file?.mimetype || '').toLowerCase();

    if (!originalName) {
        throw new AppError('Bad Request', 'El nombre de una imagen es obligatorio', 400);
    }

    if (originalName.length > 255) {
        throw new AppError('Bad Request', 'El nombre de una imagen es demasiado largo', 400);
    }

    if (!acceptedMimeTypes?.has(mimeType)) {
        throw new AppError(
            'Bad Request',
            `Formato de imagen no permitido: ${originalName}`,
            400
        );
    }

    if (!Number.isFinite(file?.size) || file.size < 1 || file.size > MAX_PRODUCT_IMAGE_SIZE) {
        throw new AppError(
            'Bad Request',
            `La imagen ${originalName} debe pesar como maximo 5 MB`,
            400
        );
    }

    return { originalName, extension, mimeType };
};

const productUploadDirectory = (productId) => {
    if (!Number.isInteger(Number(productId)) || Number(productId) < 1) {
        throw new AppError('Internal Server Error', 'Id de producto invalido para almacenar imagenes', 500);
    }

    const directory = path.resolve(LOCAL_UPLOADS_ROOT, String(productId));

    if (path.dirname(directory) !== LOCAL_UPLOADS_ROOT) {
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

const cloudinaryVariantFolder = (productId, variantId) => {
    if (!Number.isInteger(Number(productId)) || Number(productId) < 1
        || !Number.isInteger(Number(variantId)) || Number(variantId) < 1) {
        throw new AppError('Internal Server Error', 'Ids invalidos para almacenar imagenes', 500);
    }

    return `${CLOUDINARY_FOLDER_ROOT}/${Number(productId)}/variants/${Number(variantId)}`;
};

const isCloudinaryFile = (file) => {
    try {
        return new URL(String(file?.url || '')).hostname.toLowerCase() === 'res.cloudinary.com';
    } catch {
        return false;
    }
};

const saveSession = (req) => new Promise((resolve, reject) => {
    req.session.save((error) => {
        if (error) return reject(error);
        return resolve();
    });
});

const diskStorage = multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, TEMP_UPLOAD_DIRECTORY),
    filename: (_req, file, callback) => {
        const extension = path.extname(file.originalname).toLowerCase();
        callback(null, `${randomUUID()}${extension}`);
    }
});

const fileFilter = (_req, file, callback) => {
    try {
        validateFileMetadata({
            ...file,
            size:1
        });
        return callback(null, true);
    } catch (error) {
        return callback(error);
    }
};

const createUploader = (storage) => multer({
    storage,
    fileFilter,
    limits:{
        fileSize:MAX_PRODUCT_IMAGE_SIZE,
        files:MAX_PRODUCT_IMAGES,
        fields:16,
        parts:MAX_PRODUCT_IMAGES + 16
    }
});

const localUploader = createUploader(diskStorage);
const cloudinaryUploader = createUploader(multer.memoryStorage());

const removeTemporaryFiles = async (files = []) => {
    await Promise.all(files.map(async (file) => {
        if (!file?.path) return;

        try {
            await fs.unlink(file.path);
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
        }
    }));
};

const multerErrorMessage = (error) => {
    switch (error.code) {
        case 'LIMIT_FILE_SIZE':
            return 'Cada imagen debe pesar como maximo 5 MB';
        case 'LIMIT_FILE_COUNT':
        case 'LIMIT_UNEXPECTED_FILE':
            return `Se permiten hasta ${MAX_PRODUCT_IMAGES} imagenes por carga`;
        case 'LIMIT_FIELD_COUNT':
        case 'LIMIT_PART_COUNT':
            return 'El formulario contiene demasiados campos';
        default:
            return 'No se pudieron procesar las imagenes enviadas';
    }
};

export const uploadProductImages = (req, res, next) => {
    const uploader = getFileStorageDriver() === 'local'
        ? localUploader
        : cloudinaryUploader;

    uploader.array('imagenes', MAX_PRODUCT_IMAGES)(req, res, (error) => {
        if (error) {
            const normalizedError = error instanceof multer.MulterError
                ? new AppError('Bad Request', multerErrorMessage(error), 400)
                : error;

            return next(normalizedError);
        }

        let cleanupStarted = false;
        const cleanup = () => {
            if (cleanupStarted) return;
            cleanupStarted = true;

            removeTemporaryFiles(req.files).catch((cleanupError) => {
                console.error('No se pudieron limpiar archivos temporales:', cleanupError);
            });
        };

        res.once('finish', cleanup);
        res.once('close', cleanup);

        return next();
    });
};

export const handleProductUploadError = async (error, req, res, next) => {
    await removeTemporaryFiles(req.files).catch((cleanupError) => {
        console.error('No se pudieron limpiar archivos temporales rechazados:', cleanupError);
    });

    const status = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    const internalError = status >= 500;
    const message = internalError
        ? 'No se pudieron procesar las imagenes. Intenta nuevamente.'
        : error.message;
    const isProductUpdate = req.path === '/admin/productos/actualizar';
    const variantProductId = Number(req.params?.productId);
    const variantId = Number(req.params?.variantId);
    const isVariantRequest = Number.isInteger(variantProductId)
        && variantProductId > 0
        && req.path.includes('/variantes');
    const isVariantUpdate = isVariantRequest && Number.isInteger(variantId) && variantId > 0;
    const productId = Number(req.body?.id);
    const updateRedirect = Number.isInteger(productId) && productId > 0
        ? url(`/admin/producto/edit/${productId}`)
        : url('/admin/productos');
    const variantRedirect = isVariantUpdate
        ? url(`/admin/productos/${variantProductId}/variantes/${variantId}/editar`)
        : url(`/admin/productos/${variantProductId}/variantes/nueva`);
    const redirectTo = isVariantRequest
        ? variantRedirect
        : isProductUpdate
            ? updateRedirect
            : url('/admin/productos/nuevo');

    if (esPeticionAjax(req)) {
        return res.status(status).json({
            data:null,
            error:internalError ? 'Internal Server Error' : error?.error || 'Bad Request',
            message,
            status,
            redirectTo
        });
    }

    if (internalError) {
        console.error('Error interno al recibir imagenes de producto:', error);
    }

    req.session.product_message = { type:'error', message };
    const formData = {
        id:req.body?.id,
        producto_id:req.body?.producto_id,
        variante_id:req.body?.variante_id,
        nombre:req.body?.nombre,
        descripcion:req.body?.descripcion,
        talle:req.body?.talle,
        stock:req.body?.stock,
        color:req.body?.color,
        precio:req.body?.precio,
        categoria:req.body?.categoria,
        eliminar_imagenes:req.body?.eliminar_imagenes
    };

    if (isVariantRequest) {
        req.session.variant_form_data = formData;
    } else if (isProductUpdate) {
        req.session.product_update_form_data = formData;
    } else {
        req.session.product_form_data = formData;
    }

    try {
        await saveSession(req);
    } catch (sessionError) {
        return next(sessionError);
    }

    return res.redirect(303, redirectTo);
};

export class FileService {
    #fileModel;
    #cloudinary;
    #environment;
    #cloudinaryConfig;

    constructor(options = {}){
        this.#fileModel = options.fileModel || new FileModel();
        this.#cloudinary = options.cloudinaryClient || cloudinary;
        this.#environment = options.environment || process.env.NODE_ENV || 'development';
        this.#cloudinaryConfig = options.cloudinaryConfig || null;
    }

    get storageDriver(){
        return getFileStorageDriver(this.#environment);
    }

    normalizeFileIds(value){
        const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
        const ids = values.map(Number);

        if (ids.some((id) => !Number.isInteger(id) || id < 1)) {
            throw new AppError('Bad Request', 'La seleccion de imagenes no es valida', 400);
        }

        return [...new Set(ids)];
    }

    async validateProductImages(files){
        if (!Array.isArray(files) || files.length === 0) return;

        for (const file of files) {
            const { originalName, extension } = validateFileMetadata(file);
            let validationPath = file.path;
            let removeValidationFile = false;

            if (!validationPath) {
                if (!Buffer.isBuffer(file.buffer)) {
                    throw new AppError(
                        'Internal Server Error',
                        `No se pudo leer la imagen ${originalName}`,
                        500
                    );
                }

                validationPath = path.join(TEMP_UPLOAD_DIRECTORY, `${randomUUID()}${extension}`);
                await fs.writeFile(validationPath, file.buffer, { flag:'wx' });
                removeValidationFile = true;
            }

            try {
                const validation = await validateFile(validationPath, {
                    maxSizeInBytes:MAX_PRODUCT_IMAGE_SIZE
                });

                if (!validation.status) {
                    throw new AppError(
                        'Bad Request',
                        `La imagen ${originalName} no es valida: ${validation.message}`,
                        400
                    );
                }
            } finally {
                if (removeValidationFile) {
                    await fs.unlink(validationPath).catch((error) => {
                        if (error.code !== 'ENOENT') throw error;
                    });
                }
            }
        }
    }

    async storeVariantImages(files, productId, variantId){
        if (!Array.isArray(files) || files.length === 0) return [];

        return this.storageDriver === 'cloudinary'
            ? this.#storeVariantImagesInCloudinary(files, productId, variantId)
            : this.#storeVariantImagesLocally(files, productId, variantId);
    }

    async removeStoredVariantFiles(files, productId, variantId){
        if (!Array.isArray(files) || files.length === 0) return;

        const directory = variantUploadDirectory(productId, variantId);

        await Promise.all(files.map(async (file) => {
            if (isCloudinaryFile(file)) {
                await this.#destroyCloudinaryFile(file);
                return;
            }

            const filename = path.basename(file?.nombre || '');
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
    }

    async removeVariantStorage(files, productId, variantId){
        await this.removeStoredVariantFiles(files, productId, variantId);
        await fs.rm(variantUploadDirectory(productId, variantId), { recursive:true, force:true });
    }

    async findByProductId(productId){
        return this.#fileModel.findByProductId(productId);
    }

    async findByVariantId(productId, variantId){
        return this.#fileModel.findByVariantId(productId, variantId);
    }

    async findVariantFilesByIds(productId, variantId, fileIds){
        return this.#fileModel.findVariantFilesByIds(productId, variantId, fileIds);
    }

    async createManyForVariant(productId, variantId, files){
        return this.#fileModel.createManyForVariant(productId, variantId, files);
    }

    async deleteManyForVariant(productId, variantId, fileIds){
        return this.#fileModel.deleteManyForVariant(productId, variantId, fileIds);
    }

    #configureCloudinary(){
        const config = this.#cloudinaryConfig || {
            cloud_name:process.env.CLOUDINARY_CLOUD_NAME,
            api_key:process.env.CLOUDINARY_API_KEY,
            api_secret:process.env.CLOUDINARY_API_SECRET
        };
        const missingKeys = Object.entries(config)
            .filter(([, value]) => !value)
            .map(([key]) => key);

        if (missingKeys.length > 0) {
            throw new AppError(
                'Internal Server Error',
                `Configuracion de Cloudinary incompleta: ${missingKeys.join(', ')}`,
                500
            );
        }

        this.#cloudinary.config({ ...config, secure:true });
    }

    async #storeVariantImagesLocally(files, productId, variantId){
        const directory = variantUploadDirectory(productId, variantId);
        await fs.mkdir(directory, { recursive:true });
        const storedPaths = [];

        try {
            const storedFiles = [];

            for (const file of files) {
                const { originalName, mimeType } = validateFileMetadata(file);
                const filename = path.basename(file.filename || '');

                if (!filename || !file.path) {
                    throw new AppError('Internal Server Error', 'Archivo temporal de imagen invalido', 500);
                }

                const destination = path.resolve(directory, filename);
                if (path.dirname(destination) !== directory) {
                    throw new AppError('Internal Server Error', 'Ruta de destino de imagen invalida', 500);
                }

                await fs.rename(file.path, destination);
                storedPaths.push(destination);
                storedFiles.push({
                    url:`/uploads/${Number(productId)}/variants/${Number(variantId)}/${filename}`,
                    nombre:filename,
                    nombre_original:originalName,
                    mime_type:mimeType,
                    size:file.size
                });
            }

            return storedFiles;
        } catch (error) {
            await Promise.allSettled(storedPaths.map((storedPath) => fs.unlink(storedPath)));
            throw error;
        }
    }

    async #storeVariantImagesInCloudinary(files, productId, variantId){
        this.#configureCloudinary();
        const folder = cloudinaryVariantFolder(productId, variantId);
        const storedFiles = [];

        try {
            for (const file of files) {
                const { originalName, mimeType } = validateFileMetadata(file);
                const buffer = Buffer.isBuffer(file.buffer)
                    ? file.buffer
                    : file.path
                        ? await fs.readFile(file.path)
                        : null;

                if (!buffer) {
                    throw new AppError('Internal Server Error', `No se pudo leer la imagen ${originalName}`, 500);
                }

                const result = await this.#uploadBufferToCloudinary(buffer, {
                    folder,
                    public_id:randomUUID(),
                    resource_type:'image',
                    overwrite:false,
                    unique_filename:false,
                    use_filename:false,
                    disable_promise:true
                });

                storedFiles.push({
                    url:result.secure_url,
                    nombre:result.public_id,
                    nombre_original:originalName,
                    mime_type:mimeType,
                    size:Number(result.bytes) || file.size
                });
            }

            return storedFiles;
        } catch (error) {
            const cleanupResults = await Promise.allSettled(
                storedFiles.map((file) => this.#destroyCloudinaryFile(file))
            );

            for (const cleanupResult of cleanupResults) {
                if (cleanupResult.status === 'rejected') {
                    console.error('No se pudo revertir una imagen subida a Cloudinary:', cleanupResult.reason);
                }
            }

            throw error instanceof AppError
                ? error
                : new AppError(
                    'Internal Server Error',
                    `No se pudieron almacenar las imagenes en Cloudinary: ${error.message}`,
                    500
                );
        }
    }

    #uploadBufferToCloudinary(buffer, options){
        return new Promise((resolve, reject) => {
            const uploadStream = this.#cloudinary.uploader.upload_stream(options, (error, result) => {
                if (error) return reject(error);
                if (!result?.secure_url || !result?.public_id) {
                    return reject(new Error('Cloudinary no devolvio los identificadores del archivo'));
                }

                return resolve(result);
            });

            uploadStream.end(buffer);
        });
    }

    async #destroyCloudinaryFile(file){
        const publicId = String(file?.nombre || '').trim();
        if (!publicId) {
            throw new AppError('Internal Server Error', 'Public ID de Cloudinary inexistente', 500);
        }

        this.#configureCloudinary();
        const result = await this.#cloudinary.uploader.destroy(publicId, {
            resource_type:'image',
            invalidate:true
        });

        if (!['ok', 'not found'].includes(result?.result)) {
            throw new AppError(
                'Internal Server Error',
                `Cloudinary no pudo eliminar el archivo ${publicId}`,
                500
            );
        }
    }
}
