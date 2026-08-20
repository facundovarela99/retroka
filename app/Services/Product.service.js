import zod from 'zod';
import { AppError } from '../Models/Error.model.js';
import {
    stringCapitalizado, 
    stringCapitalizadoOpcional, 
    numeroConDefault,
    numeroRequerido,
    numeroOpcional
} from '../Helpers.js';

const MAX_PRODUCT_IMAGES = 8;

const productImageUrlSchema = zod.string({
    invalid_type_error: 'Cada imagen debe ser una URL valida'
})
    .trim()
    .min(1, { message: 'La URL de la imagen no puede estar vacia' })
    .max(255, { message: 'La URL de la imagen es demasiado larga' })
    .regex(
        /^\/uploads\/[1-9]\d*\/[a-f0-9-]+\.(?:gif|jpe?g|png|svg)$/i,
        { message: 'La URL de la imagen no pertenece al directorio de productos' }
    );


const newProductSchema = zod.object({
    nombre: stringCapitalizado(zod.string({
        invalid_type_error: 'El nombre de debe ser una cadena de caracteres.',
        required_error: 'El nombre es obligatorio'
    }), 'El nombre es obligatorio'),
    descripcion: stringCapitalizado(zod.string({
        invalid_type_error: 'La descripcion de debe ser una cadena de caracteres.',
        required_error: 'La descripcion es obligatorio'
    }), 'La descripcion es obligatoria'),
    talle: numeroRequerido(
        zod.number().int().positive(),
        'El talle es obligatorio',
        'El talle debe ser un numero valido'
    ),
    stock: numeroConDefault(zod.number({
        invalid_type_error: 'El stock debe ser un numero entero',
        required_error: 'El stock es obligatorio'
    }).int().min(0, { message: 'El stock no puede ser negativo' })),
    precio: numeroConDefault(zod.number({
        invalid_type_error: 'El precio debe ser un numero',
        required_error: 'El precio es obligatorio'
    }).min(0, { message: 'El precio no puede ser negativo' })),
    imagenes: zod.array(productImageUrlSchema, {
        invalid_type_error: 'Las imagenes deben ser un arreglo de URLs'
    })
        .max(MAX_PRODUCT_IMAGES, { message: `Se permiten hasta ${MAX_PRODUCT_IMAGES} imagenes` })
        .default([]),
    categoria: numeroOpcional(zod.number({
        invalid_type_error: 'La categoría debe ser un número',
        required_error: 'La categoría es obligatoria'
    }).int().positive(), 'La categoría debe ser un número')
});

const updatedProductSchema = zod.object({
    nombre: stringCapitalizadoOpcional(zod.string({
        invalid_type_error: 'El nombre de debe ser una cadena de caracteres.',
        required_error: 'El nombre es obligatorio'
    })),
    descripcion: stringCapitalizadoOpcional(zod.string({
        invalid_type_error: 'La descripcion de debe ser una cadena de caracteres.',
        required_error: 'La descripcion es obligatorio'
    })),
    talle: numeroOpcional(
        zod.number().int().positive(),
        'El talle debe ser un numero valido'
    ),
    stock: numeroOpcional(zod.number({
        invalid_type_error: 'El stock debe ser un numero entero',
        required_error: 'El stock es obligatorio'
    }).int().min(0, { message: 'El stock no puede ser negativo' })),
    precio: numeroOpcional(zod.number({
        invalid_type_error: 'El precio debe ser un numero',
        required_error: 'El precio es obligatorio'
    }).min(0, { message: 'El precio no puede ser negativo' })),
    categoria: numeroOpcional(zod.number({
        invalid_type_error: 'La categoría debe ser un número',
        required_error: 'La categoría es obligatoria'
    }).int().positive(), 'La categoría debe ser un número')
});


export function validarNuevoProducto(object) {
    const result = newProductSchema.safeParse(object);

    if (!result.success) {
        const message = result.error.issues.map((issue) => issue.message).join(', ');
        throw new AppError('Bad Request', message, 400);
    }

    return result.data;
}

export function validarProductoActualizacion(object){
    const result = updatedProductSchema.safeParse(object);

    if (!result.success) {
        const message = result.error.issues.map((issue) => issue.message).join(', ');
        throw new AppError('Bad Request', message, 400);
    }

    return result.data;
}
