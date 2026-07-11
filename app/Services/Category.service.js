import zod from 'zod';
import { capitalizarPrimerLetra, stringCapitalizado } from '../Helpers.js';
import { AppError } from '../Models/Error.model.js';

const categorySchema = zod.object({
    nombre: stringCapitalizado(zod.string({
            invalid_type_error: 'El nombre de debe ser una cadena de caracteres.',
            required_error: 'El nombre es obligatorio'
        }), 'El nombre es obligatorio'),
})


export function validarCategoria(object){
    const result = categorySchema.safeParse(object);
    if (!result.success) {
        const message = result.error.issues.map((issue) => issue.message).join(', ');
        throw new AppError('Bad Request', message, 400);
    }

    return result.data;
}