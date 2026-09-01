import zod from 'zod';
import { AppError } from '../Models/Error.model.js';
import {
    stringCapitalizado,
    stringCapitalizadoOpcional,
    numeroOpcional
} from '../Helpers.js';

const categorySchema = numeroOpcional(zod.number({
    invalid_type_error:'La categoria debe ser un numero',
    required_error:'La categoria es obligatoria'
}).int().positive(), 'La categoria debe ser un numero');

const newProductSchema = zod.object({
    nombre:stringCapitalizado(zod.string({
        invalid_type_error:'El nombre debe ser una cadena de caracteres.',
        required_error:'El nombre es obligatorio'
    }), 'El nombre es obligatorio'),
    descripcion:stringCapitalizado(zod.string({
        invalid_type_error:'La descripcion debe ser una cadena de caracteres.',
        required_error:'La descripcion es obligatoria'
    }), 'La descripcion es obligatoria'),
    categoria:categorySchema
});

const updatedProductSchema = zod.object({
    nombre:stringCapitalizadoOpcional(zod.string({
        invalid_type_error:'El nombre debe ser una cadena de caracteres.'
    })),
    descripcion:stringCapitalizadoOpcional(zod.string({
        invalid_type_error:'La descripcion debe ser una cadena de caracteres.'
    })),
    categoria:categorySchema
});

const validate = (schema, object) => {
    const result = schema.safeParse(object);

    if (!result.success) {
        const message = result.error.issues.map((issue) => issue.message).join(', ');
        throw new AppError('Bad Request', message, 400);
    }

    return result.data;
};

export const validarNuevoProducto = (object) => validate(newProductSchema, object);

export const validarProductoActualizacion = (object) => validate(updatedProductSchema, object);
