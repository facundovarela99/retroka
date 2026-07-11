import bcrypt from 'bcrypt';
import zod from 'zod';
import { AppError } from '../Models/Error.model.js';

export async function comparePwd(password, userPwd) {
    const result = await bcrypt.compare(password, userPwd);
    if (!result) {
        throw new AppError('Unauthorized', 'Contrasena incorrecta', 401);
    }
    return result;
}

export async function encrypt(password) {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
}

const userSchema = zod.object({
    nombre: zod.string({
        invalid_type_error: 'El nombre de debe ser una cadena.',
        required_error: 'El nombre es obligatorio'
    }),
    email: zod.string({
        invalid_type_error: 'El email de debe ser una cadena.',
        required_error: 'El email es obligatorio'
    }).email(),
    password: zod.string()
        .min(8, { message: "La contrasena debe tener al menos 8 caracteres" })
        .max(20, { message: "La contrasena no debe exceder los 20 caracteres" })
        .regex(/[A-Z]/, { message: "Debe contener al menos una letra mayuscula" })
        .regex(/[a-z]/, { message: "Debe contener al menos una letra minuscula" })
        .regex(/[0-9]/, { message: "Debe contener al menos un numero" })
        .regex(/[^A-Za-z0-9]/, { message: "Debe contener al menos un caracter especial" }),
    telefono: zod.string()
        .min(7, {message: "El numero de telefono debe tener un minimo de 7 numeros"})
        .max(13, {message: 'El numero de telefono no debe exceder los 13 numeros'})
        .optional(),
    is_admin: zod.boolean().optional()
}).passthrough()

export function validarNuevoUsuario(object){
    (object.is_admin === '1') ? object.is_admin = true :object.is_admin = false;

    const result = userSchema.safeParse(object);

    if (!result.success) {
        const message = result.error.issues.map((issue) => issue.message).join(', ');
        throw new AppError('Bad Request', message, 400);
    }

    return result.data;
}

export async function setAuthenticatedSession(req, user) {
        if (!req.session) {
            throw new AppError('Internal Server Error', 'La sesion no esta inicializada', 500);
        }

        await new Promise((resolve, reject) => {
            req.session.regenerate((err) => {
                if (err) return reject(err);
                resolve();
            });
        });

        req.session.user = {
            id: user.id,
            email: user.email,
            is_admin: user.is_admin
        };

        await new Promise((resolve, reject) => {
            req.session.save((err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    }