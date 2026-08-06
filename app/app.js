import express from 'express';
import './Config/Env.js';
import { router } from './Config/Router.js';
import { AppSession } from './Middleware/Session.middleware.js';
import { esPeticionAjax } from './Helpers.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = process.env.PORT;
const app = express();

if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

app.disable('x-powered-by');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../public/views'));

app.use('/assets', express.static(path.join(__dirname, '../public/assets')));
app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});
app.use(AppSession());
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use('/retroka', router);

app.use((req, res) => {
    res.status(404).send('<h1>Error: pagina no encontrada</h1>');
});

app.use((error, req, res, next) => {
    if (res.headersSent) {
        return next(error);
    }

    const status = Number.isInteger(error.status) ? error.status : 500;
    const message = status === 413
        ? 'La peticion excede el tamano permitido'
        : status >= 500
            ? 'Error interno del servidor'
            : 'La peticion no es valida';

    res.set('Cache-Control', 'no-store');

    if (esPeticionAjax(req)) {
        return res.status(status).json({
            data: null,
            error: status >= 500 ? 'Internal Server Error' : 'Bad Request',
            message,
            status
        });
    }

    if (/^\/retroka\/(login|registro|logout)(?:\/|$)/.test(req.originalUrl)) {
        if (req.session) {
            req.session.auth_message = { type: 'error', message };
        }

        return res.redirect(303, '/retroka/login');
    }

    return res.status(status).send(`<h1>${message}</h1>`);
});

app.listen(port, () => {
    console.log(`Escuchando servidor en http://localhost:${port}`);
});
