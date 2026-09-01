import { AppError } from '../Models/Error.model.js';
import { UserModel } from '../Models/User.model.js';
import {
    encrypt,
    setAuthenticatedSession,
    validarCredenciales,
    validarLogin,
    validarNuevoUsuario
} from '../Services/Auth.service.js';
import { SESSION_COOKIE_NAME } from '../Middleware/Session.middleware.js';
import { resetAuthRateLimit } from '../Middleware/Auth.middleware.js';
import { url } from '../Config/Env.js';
import { cartController } from './Cart.Controller.js';
import {
    esPeticionAjax,
    obtenerCsrfToken,
    validarCsrfToken
} from '../Helpers.js';

const LOGIN_PATH = '/login';
const DEFAULT_AUTH_PATH = '/productos';

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
};

const responsePayload = ({ data = null, error = null, message, status, redirectTo }) => ({
    data,
    ...(error ? { error } : {}),
    message,
    status,
    redirectTo
});

const responder = (req, res, { status, payload, redirectTo, flashType = null }) => {
    res.set('Cache-Control', 'no-store');

    if (esPeticionAjax(req)) {
        return res.status(status).json(payload);
    }

    if (flashType && req.session) {
        req.session.auth_message = {
            type: flashType,
            message: payload.message
        };
    }

    return res.redirect(303, redirectTo);
};

const responderError = (req, res, error, redirectPath) => {
    const status = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    const internalError = status >= 500;
    const message = internalError
        ? 'No se pudo completar la autenticacion. Intenta nuevamente.'
        : error.message;

    if (internalError) {
        console.error('Error interno de autenticacion:', error);
    }

    return responder(req, res, {
        status,
        payload: responsePayload({
            error: internalError ? 'Internal Server Error' : error.error,
            message,
            status,
            redirectTo: redirectPath
        }),
        redirectTo: redirectPath,
        flashType: 'error'
    });
};

const exigirCsrf = (req) => {
    if (!validarCsrfToken(req)) {
        throw new AppError('Forbidden', 'CSRF token invalido', 403);
    }
};

export class AuthController {
    #userModel;
    #cartController;

    constructor(){
        this.#userModel = new UserModel();
        this.#cartController = cartController;
    }

    async showRegister(req, res){
        if (req.session?.user){
            return res.redirect(303, DEFAULT_AUTH_PATH);
        }

        const authMessage = req.session?.auth_message || null;

        if (req.session?.auth_message) {
            delete req.session.auth_message;
        }

        res.set('Cache-Control', 'no-store');

        const GEOREF_API_BASE = process.env.GEOREF_API_BASE;

        return res.status(200).render('site/registro', {
            title: 'Registro',
            url,
            GEOREF_API_BASE: GEOREF_API_BASE,
            csrf_token: obtenerCsrfToken(req),
            auth_message: authMessage
        });
    }

    async register(req, res){
        try {
            exigirCsrf(req);
            console.log('Body de la request al registrarse: ', req.body);
            const body = validarNuevoUsuario(req.body);

            const userExist = await this.#userModel.findByColumns(['id'], 'email', body.email);

            if (userExist) {
                throw new AppError('Conflict', 'El correo ya se encuentra en uso', 409);
            }

            body.password = await encrypt(body.password);

            const user = await this.#userModel.create(body);
            await setAuthenticatedSession(req, user);
            resetAuthRateLimit(req, 'register');

            res.clearCookie('access_token', cookieOptions);

            const payload = responsePayload({
                data: { authenticated: true },
                message: 'Registro exitoso',
                status: 201,
                redirectTo: DEFAULT_AUTH_PATH
            });

            return responder(req, res, {
                status: 201,
                payload,
                redirectTo: DEFAULT_AUTH_PATH,
                flashType: 'success',
            });
        } catch (error) {
            return responderError(req, res, error, '/registro');
        }
    }

    async showLogin(req, res){
        if (req.session?.user){
            return res.redirect(303, DEFAULT_AUTH_PATH);
        }

        const authMessage = req.session?.auth_message || null;

        if (req.session?.auth_message) {
            delete req.session.auth_message;
        }

        res.set('Cache-Control', 'no-store');

        return res.status(200).render('site/login', {
            title: 'Login',
            url,
            csrf_token: obtenerCsrfToken(req),
            auth_message: authMessage
        });
    }

    async login(req, res) {
        try {
            exigirCsrf(req);

            const { email, password } = validarLogin(req.body);
            const carritoLocal = Array.isArray(req.body.carrito) ? req.body.carrito : [];
            const user = await this.#userModel.findForAuthentication(email);

            await validarCredenciales(password, user);
            await setAuthenticatedSession(req, user);
            resetAuthRateLimit(req, 'login');

            res.clearCookie('access_token', cookieOptions);

            const resultadoCarrito = await this.#sincronizarCarritoInvitado(req, user, carritoLocal);
            const payload = {
                ...responsePayload({
                    data: { authenticated: true },
                    message: 'Login exitoso',
                    status: 200,
                    redirectTo: DEFAULT_AUTH_PATH
                }),
                carrito: resultadoCarrito
            };

            return responder(req, res, {
                status: 200,
                payload,
                redirectTo: DEFAULT_AUTH_PATH
            });
        } catch (error) {
            return responderError(req, res, error, '/login');
        }
    }

    async logout(req, res){
        try {
            exigirCsrf(req);

            await new Promise((resolve, reject) => {
                req.session.destroy((error) => {
                    if (error) return reject(error);
                    resolve();
                });
            });

            res.clearCookie(SESSION_COOKIE_NAME, cookieOptions);
            res.clearCookie('access_token', cookieOptions);

            const payload = responsePayload({
                data: { authenticated: false },
                message: 'Sesion cerrada',
                status: 200,
                redirectTo: DEFAULT_AUTH_PATH
            });

            return responder(req, res, {
                status: 200,
                payload,
                redirectTo: DEFAULT_AUTH_PATH
            });
        } catch (error) {
            return responderError(req, res, error, '/productos');
        }
    }

    async #sincronizarCarritoInvitado(req, user, carritoLocal) {
        if (carritoLocal.length === 0) {
            return null;
        }

        try {
            req.body.carrito = carritoLocal;

            if (await this.#userModel.getUserCart(user.id) !== null) {
                return await this.#cartController.update(req, null, true);
            }

            return await this.#cartController.create(req, null, true);
        } catch (error) {
            console.error('No se pudo sincronizar el carrito durante el login:', error);

            return {
                status: 'warning',
                data: false,
                message: 'El login fue exitoso, pero no se pudo sincronizar el carrito',
                productos: []
            };
        }
    }
}

export const authController = new AuthController();
