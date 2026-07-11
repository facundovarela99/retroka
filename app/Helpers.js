import zod from 'zod';

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
