import zod from 'zod';
import { randomBytes, timingSafeEqual } from 'crypto';

export function capitalizarPrimerLetra(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

export const stringCapitalizado = (schema, emptyMessage) => schema
    .trim()
    .min(1, { message: emptyMessage })
    .transform((value) => capitalizarPrimerLetra(value));

export const stringEnMayuscula = (schema, emptyMessage) => schema
    .trim()
    .min(1, { message: emptyMessage })
    .transform((value) => value.toUpperCase());

export const stringOpcional = (schema) => schema
    .trim()
    .default('');

export const numeroConDefault = (schema) => zod.preprocess((value) => {
    if (typeof value !== 'string') return value;

    const trimmedValue = value.trim();
    return trimmedValue === '' ? undefined : Number(trimmedValue);
}, schema.default(0));

export const numeroRequerido = (schema, requiredMessage, invalidNumberMessage = 'El campo debe ser un numero') => zod.preprocess((value) => {
    if (typeof value !== 'string') return value;

    const trimmedValue = value.trim();
    return trimmedValue === '' ? undefined : Number(trimmedValue);
}, zod.any().superRefine((value, ctx) => {
    if (value === undefined) {
        ctx.addIssue({
            code: 'custom',
            message: requiredMessage
        });
        return;
    }

    if (typeof value !== 'number' || Number.isNaN(value)) {
        ctx.addIssue({
            code: 'custom',
            message: invalidNumberMessage
        });
    }
}).pipe(schema));

export const valorOpcional = (value) => {
    if (typeof value !== 'string') return value;

    const trimmedValue = value.trim();
    return trimmedValue === '' ? undefined : value;
};

export const stringCapitalizadoOpcional = (schema) => zod.preprocess(
    valorOpcional,
    schema.trim().transform((value) => capitalizarPrimerLetra(value)).optional()
);

export const stringEnMayusculaOpcional = (schema) => zod.preprocess(
    valorOpcional,
    schema.trim().min(1, { message: 'El talle debe tener al menos un caracter' }).transform((value) => value.toUpperCase()).optional()
);

export const stringOpcionalActualizacion = (schema) => zod.preprocess(
    valorOpcional,
    schema.trim().optional()
);

export const numeroOpcional = (schema, invalidNumberMessage = 'El campo debe ser un numero') => zod.preprocess((value) => {
    if (typeof value !== 'string') return value;

    const trimmedValue = value.trim();
    return trimmedValue === '' ? undefined : Number(trimmedValue);
}, zod.any().superRefine((value, ctx) => {
    if (value === undefined) return;

    if (typeof value !== 'number' || Number.isNaN(value)) {
        ctx.addIssue({
            code: 'custom',
            message: invalidNumberMessage
        });
    }
}).pipe(schema.optional()));

export function generarCsrfToken(req) {
    req.session.csrf_token = randomBytes(32).toString('hex');

    return req.session.csrf_token;
}

export function obtenerCsrfToken(req) {
    if (!req.session?.csrf_token){
        return generarCsrfToken(req);
    }
    return req.session?.csrf_token || null;
}

export function validarCsrfToken(req) {
    const tokenEnviado = req.get('x-csrf-token') || req.body?.csrf_token;
    const tokenSesion = req.session?.csrf_token;

    if (typeof tokenEnviado !== 'string' || typeof tokenSesion !== 'string') {
        return false;
    }

    const tokenEnviadoBuffer = Buffer.from(tokenEnviado);
    const tokenSesionBuffer = Buffer.from(tokenSesion);

    return tokenEnviadoBuffer.length === tokenSesionBuffer.length
        && timingSafeEqual(tokenEnviadoBuffer, tokenSesionBuffer);
}

export function esPeticionAjax(req) {
    const requestedWith = req.get('x-requested-with');
    const accept = req.get('accept') || '';
    const contentType = req.get('content-type') || '';

    return req.xhr
        || requestedWith?.toLowerCase() === 'xmlhttprequest'
        || accept.toLowerCase().includes('application/json')
        || contentType.toLowerCase().includes('application/json');
}

export function sessionMessage(req, message, type){
    req.session.message = message;

    if(type){
        req.session.message_type = type;
    }
}

export function getSessionMessage(req){
    const message = req.session?.message || null;
    const type = req.session?.message_type || null;

    if (req.session.message || req.session?.message_type) {
        delete req.session.message;
        delete req.session.message_type;
    }

    return message ? { message, type } : null;
}
