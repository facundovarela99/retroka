import '../Config/Env.js';
import session from 'express-session';
import MySQLStoreFactory from 'express-mysql-session';
import { pool } from '../Config/Database.js';
import { esPeticionAjax } from '../Helpers.js';

const SESSION_MAX_AGE = Number.parseInt(process.env.SESSION_MAX_AGE_MS || '3600000', 10);
const isProduction = process.env.NODE_ENV === 'production';
const appName = (process.env.APP_NAME || 'retroka').replace(/[^a-zA-Z0-9_-]/g, '');
export const SESSION_COOKIE_NAME = `${isProduction ? '__Host-' : ''}${appName}.sid`;
const MySQLStore = MySQLStoreFactory(session);
let sessionStore;

if (!Number.isInteger(SESSION_MAX_AGE) || SESSION_MAX_AGE < 60000) {
    throw new Error('SESSION_MAX_AGE_MS debe ser un entero mayor o igual a 60000');
}

const getSessionStore = () => {
    if (!sessionStore) {
        sessionStore = new MySQLStore({
            createDatabaseTable: false,
            expiration: SESSION_MAX_AGE,
            schema: {
                tableName: 'sessions',
                columnNames: {
                    session_id: 'session_id',
                    expires: 'expires',
                    data: 'data'
                }
            }
        }, pool);

        sessionStore.onReady().catch((error) => {
            console.error('Error al inicializar el store de sesiones:', error);
        });
    }

    return sessionStore;
};

export const AppSession = () => session({
    name: SESSION_COOKIE_NAME,
    secret: process.env.SESSION_SECRET,
    store: getSessionStore(),
    resave: false,
    saveUninitialized: false,
    unset: 'destroy',
    cookie: {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_MAX_AGE,
        priority: 'high'
    }
});

const redirectWithMessage = (req, res, redirectTo, message) => {
    req.session.auth_message = { type: 'error', message };
    return res.redirect(303, redirectTo);
};

export const requireAuth = (req, res, next) => {
    if (req.session?.user) {
        req.user = req.session.user;
        return next();
    }

    const message = 'Debes iniciar sesion para acceder a esta ruta';

    if (esPeticionAjax(req)) {
        return res.status(401).json({
            data: null,
            error: 'Unauthorized',
            message,
            status: 401,
            redirectTo: '/login'
        });
    }

    return redirectWithMessage(req, res, '/login', message);
};

export const isAdmin = (req, res, next) => {
    if (req.session?.user?.is_admin) {
        req.user = req.session.user;
        return next();
    }

    const authenticated = Boolean(req.session?.user);
    const status = authenticated ? 403 : 401;
    const message = authenticated
        ? 'No tenes permisos para realizar esta accion'
        : 'Debes iniciar sesion para acceder a esta ruta';
    const redirectTo = authenticated ? '/productos' : '/login';

    if (esPeticionAjax(req)) {
        return res.status(status).json({
            data: null,
            error: authenticated ? 'Forbidden' : 'Unauthorized',
            message,
            status,
            redirectTo
        });
    }

    return redirectWithMessage(req, res, redirectTo, message);
};
