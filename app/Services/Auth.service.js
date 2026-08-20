import '../Config/Env.js';
import bcrypt from 'bcrypt';
import zod from 'zod';
import { AppError } from '../Models/Error.model.js';

const DUMMY_PASSWORD_HASH = '$2b$12$xBLZfvPc6OheFlanG4zoBu9eGL.A/WXACcCtZtJe/Q1NHA5FSh546';
const bcryptRounds = Number.parseInt(process.env.AUTH_BCRYPT_ROUNDS || '12', 10);

if (!Number.isInteger(bcryptRounds) || bcryptRounds < 10 || bcryptRounds > 14) {
    throw new Error('AUTH_BCRYPT_ROUNDS debe ser un entero entre 10 y 14');
}

const emailSchema = zod.string({
    invalid_type_error: 'El email debe ser una cadena',
    required_error: 'El email es obligatorio'
})
    .trim()
    .toLowerCase()
    .email({ message: 'El email no es valido' })
    .max(254, { message: 'El email es demasiado largo' });

const passwordRegistroSchema = zod.string({
    invalid_type_error: 'La contraseña debe ser una cadena',
    required_error: 'La contraseña es obligatoria'
})
    .min(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
    .max(16, { message: 'La contraseña no debe exceder los 16 caracteres' })
    .regex(/[A-Z]/, { message: 'La contraseña debe contener al menos una letra mayuscula' })
    .regex(/[a-z]/, { message: 'La contraseña debe contener al menos una letra minuscula' })
    .regex(/[0-9]/, { message: 'La contraseña debe contener al menos un numero' })
    .regex(/[^A-Za-z0-9]/, { message: 'La contraseña debe contener al menos un caracter especial' })
    .refine((password) => Buffer.byteLength(password, 'utf8') <= 72, {
        message: 'La contraseña no debe exceder los 72 bytes'
    });

const campoOpcional = (schema) => zod.preprocess(
    (value) => value === '' || value === null ? undefined : value,
    schema.optional()
);

const loginSchema = zod.object({
    email: emailSchema,
    password: zod.string({
        invalid_type_error: 'La contraseña debe ser una cadena',
        required_error: 'La contraseña es obligatoria'
    })
        .min(1, { message: 'La contraseña es obligatoria' })
        .max(72, { message: 'Credenciales invalidas' })
        .refine((password) => Buffer.byteLength(password, 'utf8') <= 72, {
            message: 'Credenciales invalidas'
        })
});

const userSchema = zod.object({
    nombre: zod.string({
        invalid_type_error: 'El nombre debe ser una cadena',
        required_error: 'El nombre es obligatorio'
    })
        .trim()
        .min(2, { message: 'El nombre debe tener al menos 2 caracteres' })
        .max(100, { message: 'El nombre no debe exceder los 100 caracteres' }),
    email: emailSchema,
    password: passwordRegistroSchema,
    telefono: campoOpcional(
        zod.string()
            .trim()
            .min(7, { message: 'El telefono debe tener al menos 7 caracteres' })
            .max(20, { message: 'El telefono no debe exceder los 20 caracteres' })
            .regex(/^[0-9+() -]+$/, { message: 'El telefono no es valido' })
    ),
    codigo_postal: campoOpcional(
        zod.string().trim().max(20, { message: 'El codigo postal no debe exceder los 20 caracteres' })
    ),
    localidad: campoOpcional(
        zod.string().trim().max(100, { message: 'La localidad no debe exceder los 100 caracteres' })
    ),
    provincia: campoOpcional(
        zod.string().trim().max(100, { message: 'La provincia no debe exceder los 100 caracteres' })
    )
});

const fieldLabels = {
    nombre: 'El nombre',
    email: 'El email',
    password: 'La contraseña',
    telefono: 'El telefono',
    codigo_postal: 'El codigo postal',
    localidad: 'La localidad',
    provincia: 'La provincia'
};

const getSubmittedValue = (object, path = []) => path.reduce(
    (value, segment) => value?.[segment],
    object
);

const publicIssueMessage = (issue, object) => {
    if (issue.code !== 'invalid_type') {
        return issue.message;
    }

    const field = issue.path?.[0];
    const label = fieldLabels[field] || 'El campo';
    const submittedValue = getSubmittedValue(object, issue.path);
    const missingValue = submittedValue === undefined || submittedValue === null;

    return missingValue
        ? `${label} es obligatorio`
        : `${label} tiene un formato invalido`;
};

const parseSchema = (schema, object) => {
    const result = schema.safeParse(object);

    if (!result.success) {
        console.error('Error tecnico de validacion:', result.error);

        const message = [...new Set(
            result.error.issues.map((issue) => publicIssueMessage(issue, object))
        )].join(', ');

        throw new AppError('Bad Request', message, 400);
    }

    return result.data;
};

export async function validarCredenciales(password, user) {
    const passwordHash = user?.password || DUMMY_PASSWORD_HASH;
    const passwordValida = await bcrypt.compare(password, passwordHash);

    if (!user || !passwordValida) {
        throw new AppError('Unauthorized', 'Email o contraseña incorrectos', 401);
    }

    return user;
}

export async function encrypt(password) {
    const salt = await bcrypt.genSalt(bcryptRounds);
    return await bcrypt.hash(password, salt);
}

export function validarNuevoUsuario(object){
    const user = parseSchema(userSchema, object);

    return {
        ...user,
        is_admin: false
    };
}

export function validarLogin(object) {
    return parseSchema(loginSchema, object);
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
        is_admin: user.is_admin === true || user.is_admin === 1
    };

    await new Promise((resolve, reject) => {
        req.session.save((err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}
