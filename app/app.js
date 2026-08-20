import express from 'express';
import './Config/Env.js';
import { router } from './Config/Router.js';
import { AppSession } from './Middleware/Session.middleware.js';
import { esPeticionAjax } from './Helpers.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

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
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads'), {
    dotfiles: 'deny',
    index: false,
    maxAge: '1y',
    immutable: true,
    setHeaders: (res, filePath) => {
        res.set('X-Content-Type-Options', 'nosniff');

        if (path.extname(filePath).toLowerCase() === '.svg') {
            res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
        }
    }
}));
app.use(AppSession());
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use('/retroka', router);

app.use((req, res, next) => {
    const error = new Error('La pagina solicitada no existe');
    error.statusCode = 404;
    res.status(error.statusCode).render('error', {
        title:'Error 404',
        status:error.statusCode,
        message:'La página no existe',
        errorId: randomUUID(),
        details:'La pagina solicitada no existe en nuestro servidor',
    });
});

// app.use((req, res, next) => {
//     const error = new Error('La pagina solicitada no existe');
//     error.statusCode = 404;
//     next(error);
// });

// app.use((error, req, res, next) => {
//     if (res.headersSent) {
//         return next(error);
//     }

//     const receivedStatus = error?.statusCode ?? error?.status;
//     const status = Number.isInteger(receivedStatus) && receivedStatus >= 400 && receivedStatus <= 599
//         ? receivedStatus
//         : 500;
//     const errorId = randomUUID();
//     const isInternalError = status >= 500;
//     const isDevelopment = process.env.NODE_ENV !== 'production';
//     const message = status === 413
//         ? 'La peticion excede el tamano permitido'
//         : isInternalError
//             ? 'Error interno del servidor'
//             : error?.message || 'La peticion no es valida';

//     const logContext = {
//         errorId,
//         method: req.method,
//         path: req.originalUrl,
//         status
//     };

//     if (isInternalError) {
//         console.error('Error no controlado durante una peticion:', logContext);
//         console.error(error);
//     } else if (isDevelopment) {
//         console.warn('Peticion finalizada con error:', logContext, error?.message);
//     }

//     res.set('Cache-Control', 'no-store');

//     if (esPeticionAjax(req)) {
//         return res.status(status).json({
//             data: null,
//             error: isInternalError ? 'Internal Server Error' : error?.error || 'Request Error',
//             errorId,
//             message,
//             status,
//             ...(isDevelopment && isInternalError
//                 ? { details: error?.message, stack: error?.stack }
//                 : {})
//         });
//     }

//     return res.status(status).render('site/error', {
//         title: status === 404 ? 'Pagina no encontrada' : 'Ocurrio un error',
//         status,
//         message,
//         errorId,
//         details: isDevelopment && isInternalError ? error?.stack : null
//     });
// });

app.listen(port, () => {
    console.log(`Escuchando servidor en http://localhost:${port}`);
});
