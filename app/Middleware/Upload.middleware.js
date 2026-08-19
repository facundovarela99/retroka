import multer from 'multer';
import { randomUUID } from 'crypto';
import { mkdirSync, promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { AppError } from '../Models/Error.model.js';
import { esPeticionAjax } from '../Helpers.js';

export const MAX_PRODUCT_IMAGES = 8;
export const MAX_PRODUCT_IMAGE_SIZE = 5 * 1024 * 1024;

const TEMP_UPLOAD_DIRECTORY = path.join(os.tmpdir(), 'retroka-product-uploads');
const ALLOWED_IMAGE_TYPES = new Map([
    ['.jpg', new Set(['image/jpeg'])],
    ['.jpeg', new Set(['image/jpeg'])],
    ['.png', new Set(['image/png'])],
    ['.gif', new Set(['image/gif'])],
    ['.svg', new Set(['image/svg+xml'])]
]);

mkdirSync(TEMP_UPLOAD_DIRECTORY, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, callback) => {
        callback(null, TEMP_UPLOAD_DIRECTORY);
    },
    filename: (_req, file, callback) => {
        const extension = path.extname(file.originalname).toLowerCase();
        callback(null, `${randomUUID()}${extension}`);
    }
});

const fileFilter = (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const acceptedMimeTypes = ALLOWED_IMAGE_TYPES.get(extension);

    if (file.originalname.length > 255) {
        return callback(new AppError('Bad Request', 'El nombre de una imagen es demasiado largo', 400));
    }

    if (!acceptedMimeTypes?.has(file.mimetype.toLowerCase())) {
        return callback(new AppError(
            'Bad Request',
            `Formato de imagen no permitido: ${file.originalname}`,
            400
        ));
    }

    return callback(null, true);
};

const uploader = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: MAX_PRODUCT_IMAGE_SIZE,
        files: MAX_PRODUCT_IMAGES,
        fields: 16,
        parts: MAX_PRODUCT_IMAGES + 16
    }
});

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
            return `Se permiten hasta ${MAX_PRODUCT_IMAGES} imagenes por producto`;
        case 'LIMIT_FIELD_COUNT':
        case 'LIMIT_PART_COUNT':
            return 'El formulario contiene demasiados campos';
        default:
            return 'No se pudieron procesar las imagenes enviadas';
    }
};

export const uploadProductImages = (req, res, next) => {
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

    if (esPeticionAjax(req)) {
        return next(error);
    }

    if (status >= 500) {
        console.error('Error interno al recibir imagenes de producto:', error);
    }

    req.session.product_message = {
        type: 'error',
        message: status >= 500
            ? 'No se pudieron procesar las imagenes. Intenta nuevamente.'
            : error.message
    };

    return res.redirect(303, '/retroka/productos/nuevo');
};
