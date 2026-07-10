import session from "express-session";
import MySQLStoreFactory from "express-mysql-session";
import { pool } from "../Config/Database.js";

const SESSION_MAX_AGE = 1000 * 120;
export const SESSION_COOKIE_NAME = `${process.env.APP_NAME || 'retroka'}.sid`;
const MySQLStore = MySQLStoreFactory(session);
let sessionStore;

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
}

export const AppSession = () => {
    return session({
        name: SESSION_COOKIE_NAME,
        secret: process.env.SESSION_SECRET,
        store: getSessionStore(),
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: SESSION_MAX_AGE
        }
    })
}

export const requireAuth = (req, res, next) => {
    if (req.session?.user) {
        req.user = req.session.user;
        return next();
    }

    return res.status(401).json({
        data: null,
        error: 'Unauthorized',
        message: 'Debes iniciar sesion para acceder a esta ruta',
        status: 401
    });
}
