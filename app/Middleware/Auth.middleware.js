import '../Config/Env.js';
import { esPeticionAjax, validarCsrfToken } from '../Helpers.js';

const WINDOW_MS = Number.parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000', 10);
const MAX_REQUESTS = Number.parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10', 10);
const attempts = new Map();

if (!Number.isInteger(WINDOW_MS) || WINDOW_MS < 1000) {
    throw new Error('AUTH_RATE_LIMIT_WINDOW_MS debe ser un entero mayor o igual a 1000');
}

if (!Number.isInteger(MAX_REQUESTS) || MAX_REQUESTS < 1) {
    throw new Error('AUTH_RATE_LIMIT_MAX debe ser un entero mayor o igual a 1');
}

const clientKey = (req, scope) => `${scope}:${req.ip || req.socket.remoteAddress || 'unknown'}`;

const removeExpiredAttempts = (now) => {
    for (const [key, attempt] of attempts) {
        if (attempt.resetAt <= now) {
            attempts.delete(key);
        }
    }
};

export const authRateLimit = (scope) => (req, res, next) => {
    const now = Date.now();
    removeExpiredAttempts(now);

    const key = clientKey(req, scope);
    const current = attempts.get(key);
    const attempt = !current || current.resetAt <= now
        ? { count: 0, resetAt: now + WINDOW_MS }
        : current;

    if (attempt.count >= MAX_REQUESTS) {
        const retryAfter = Math.max(1, Math.ceil((attempt.resetAt - now) / 1000));
        const message = 'Demasiados intentos. Intenta nuevamente mas tarde.';

        res.set('Retry-After', String(retryAfter));
        res.set('Cache-Control', 'no-store');

        if (esPeticionAjax(req)) {
            return res.status(429).json({
                data: null,
                error: 'Too Many Requests',
                message,
                status: 429,
                redirectTo: '/login'
            });
        }

        req.session.auth_message = { type: 'error', message };
        return res.redirect(303, '/login');
    }

    attempt.count += 1;
    attempts.set(key, attempt);

    res.set('RateLimit-Limit', String(MAX_REQUESTS));
    res.set('RateLimit-Remaining', String(Math.max(0, MAX_REQUESTS - attempt.count)));
    res.set('RateLimit-Reset', String(Math.ceil(attempt.resetAt / 1000)));

    return next();
};

export const resetAuthRateLimit = (req, scope) => {
    attempts.delete(clientKey(req, scope));
};

export const requireCsrf = (req, res, next) => {
    if (validarCsrfToken(req)) {
        return next();
    }

    const message = 'CSRF token invalido';
    const redirectTo = req.session?.user ? '/productos' : '/login';

    res.set('Cache-Control', 'no-store');

    if (esPeticionAjax(req)) {
        return res.status(403).json({
            data: null,
            error: 'Forbidden',
            message,
            status: 403,
            redirectTo
        });
    }

    req.session.message = { type: 'error', message };
    return res.redirect(303, redirectTo);
};
