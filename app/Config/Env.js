import dotenv from 'dotenv';

dotenv.config({ path: '.env', quiet: true });

const requiredVariables = [
    'APP_URL',
    'PORT',
    'SESSION_SECRET',
    'DB_HOST',
    'DB_NAME',
    'DB_PORT',
    'DB_USER'
];

const missingVariables = requiredVariables.filter((key) => !process.env[key]);

if (missingVariables.length > 0) {
    throw new Error(`Faltan variables de entorno requeridas: ${missingVariables.join(', ')}`);
}

if (Buffer.byteLength(process.env.SESSION_SECRET, 'utf8') < 32) {
    throw new Error('SESSION_SECRET debe tener al menos 32 bytes');
}

if (!Number.isInteger(Number(process.env.PORT)) || Number(process.env.PORT) < 1) {
    throw new Error('PORT debe ser un puerto valido');
}

if (!Number.isInteger(Number(process.env.DB_PORT)) || Number(process.env.DB_PORT) < 1) {
    throw new Error('DB_PORT debe ser un puerto valido');
}

let appUrl;

try {
    appUrl = new URL(process.env.APP_URL);
} catch {
    throw new Error('APP_URL debe ser una URL absoluta valida');
}

if (process.env.NODE_ENV === 'production') {
    if (appUrl.protocol !== 'https:') {
        throw new Error('APP_URL debe usar HTTPS en produccion');
    }

    if (!process.env.DB_PASSWORD) {
        throw new Error('DB_PASSWORD es obligatoria en produccion');
    }
}

const cloudinaryEnvironments = new Set(['production', 'testing', 'test']);

if (cloudinaryEnvironments.has(String(process.env.NODE_ENV || '').toLowerCase())) {
    const requiredCloudinaryVariables = [
        'CLOUDINARY_CLOUD_NAME',
        'CLOUDINARY_API_KEY',
        'CLOUDINARY_API_SECRET'
    ];
    const missingCloudinaryVariables = requiredCloudinaryVariables.filter((key) => !process.env[key]);

    if (missingCloudinaryVariables.length > 0) {
        throw new Error(
            `Faltan variables de Cloudinary requeridas: ${missingCloudinaryVariables.join(', ')}`
        );
    }
}

export function base_path(){
    return process.env.APP_URL.replace(/\/+$/, '');
}

export function url(path = ''){
    const normalizedPath = String(path).replace(/^\/+/, '');
    return normalizedPath ? `${base_path()}/${normalizedPath}` : base_path();
}
