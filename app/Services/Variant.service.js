import zod from 'zod';
import { numeroOpcional, numeroRequerido } from '../Helpers.js';
import { AppError } from '../Models/Error.model.js';

const MAX_DATABASE_ID = 2147483647;
const MAX_STOCK = 2147483647;
const MAX_PRICE = 99999999.99;

const requiredId = (fieldName) => numeroRequerido(
    zod.number().int().positive().max(MAX_DATABASE_ID),
    `${fieldName} es obligatorio`,
    `${fieldName} debe ser un numero entero valido`
);

const requiredStock = numeroRequerido(
    zod.number()
        .int({ message:'El stock debe ser un numero entero' })
        .min(0, { message:'El stock no puede ser negativo' })
        .max(MAX_STOCK, { message:'El stock supera el maximo permitido' }),
    'El stock es obligatorio',
    'El stock debe ser un numero entero valido'
);

const requiredPrice = numeroRequerido(
    zod.number()
        .min(0, { message:'El precio no puede ser negativo' })
        .max(MAX_PRICE, { message:'El precio supera el maximo permitido' })
        .multipleOf(0.01, { message:'El precio puede tener hasta dos decimales' }),
    'El precio es obligatorio',
    'El precio debe ser un numero valido'
);

const newVariantSchema = zod.object({
    producto_id:requiredId('El producto'),
    talle:requiredId('El talle'),
    stock:requiredStock,
    precio:requiredPrice
});

const updatedVariantSchema = zod.object({
    talle:numeroOpcional(
        zod.number().int().positive().max(MAX_DATABASE_ID),
        'El talle debe ser un numero entero valido'
    ),
    stock:numeroOpcional(
        zod.number()
            .int({ message:'El stock debe ser un numero entero' })
            .min(0, { message:'El stock no puede ser negativo' })
            .max(MAX_STOCK, { message:'El stock supera el maximo permitido' }),
        'El stock debe ser un numero entero valido'
    ),
    precio:numeroOpcional(
        zod.number()
            .min(0, { message:'El precio no puede ser negativo' })
            .max(MAX_PRICE, { message:'El precio supera el maximo permitido' })
            .multipleOf(0.01, { message:'El precio puede tener hasta dos decimales' }),
        'El precio debe ser un numero valido'
    )
});

const parseSchema = (schema, object) => {
    const result = schema.safeParse(object);

    if (!result.success) {
        const message = [...new Set(result.error.issues.map((issue) => issue.message))].join(', ');
        throw new AppError('Bad Request', message, 400);
    }

    return result.data;
};

export const validarNuevaVariante = (object) => parseSchema(newVariantSchema, object);

export const validarActualizacionVariante = (object) => parseSchema(updatedVariantSchema, object);
