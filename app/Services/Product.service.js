import zod from 'zod';
import { AppError } from '../Models/Error.model.js';
import {
    stringCapitalizado, 
    stringCapitalizadoOpcional, 
    stringEnMayuscula, 
    stringEnMayusculaOpcional,
    numeroConDefault,
    numeroOpcional, 
    stringOpcional,
    stringOpcionalActualizacion
} from '../Helpers.js';


const newProductSchema = zod.object({
    nombre: stringCapitalizado(zod.string({
        invalid_type_error: 'El nombre de debe ser una cadena de caracteres.',
        required_error: 'El nombre es obligatorio'
    }), 'El nombre es obligatorio'),
    descripcion: stringCapitalizado(zod.string({
        invalid_type_error: 'La descripcion de debe ser una cadena de caracteres.',
        required_error: 'La descripcion es obligatorio'
    }), 'La descripcion es obligatoria'),
    talle: stringEnMayuscula(zod.string({
        invalid_type_error: 'El talle de debe ser una cadena de caracteres.',
        required_error: 'El talle es obligatorio'
    }), 'El talle debe tener al menos un caracter'),
    stock: numeroConDefault(zod.number({
        invalid_type_error: 'El stock debe ser un número no decimal',
        required_error: 'El stock es obligatorio'
    })),
    precio: numeroConDefault(zod.number({
        invalid_type_error: 'El precio debe ser un número no decimal',
        required_error: 'El precio es obligatorio'
    })),
    imagen: stringOpcional(zod.string({invalid_type_error: 'La imagen debe ser una cadena de caracteres'})),
    url: stringOpcional(zod.string({invalid_type_error: 'La url debe ser una cadena de caracteres'})),
    categoria: numeroOpcional(zod.number({
        invalid_type_error: 'La categoría debe ser un número',
        required_error: 'La categoría es obligatoria'
    }), 'La categoría debe ser un número')
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
    talle: stringEnMayusculaOpcional(zod.string({
        invalid_type_error: 'El talle de debe ser una cadena de caracteres.',
        required_error: 'El talle es obligatorio'
    })),
    stock: numeroOpcional(zod.number({
        invalid_type_error: 'El stock debe ser un número no decimal',
        required_error: 'El stock es obligatorio'
    }).min(0)),
    precio: numeroOpcional(zod.number({
        invalid_type_error: 'El precio debe ser un número no decimal',
        required_error: 'El precio es obligatorio'
    }).min(0)),
    imagen: stringOpcionalActualizacion(zod.string({invalid_type_error: 'La imagen debe ser una cadena de caracteres'})),
    url: stringOpcionalActualizacion(zod.string({invalid_type_error: 'La url debe ser una cadena de caracteres'})),
    categoria: numeroOpcional(zod.number({
        invalid_type_error: 'La categoría debe ser un número',
        required_error: 'La categoría es obligatoria'
    }), 'La categoría debe ser un número')
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
