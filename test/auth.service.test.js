import test from 'node:test';
import assert from 'node:assert/strict';
import {
    encrypt,
    setAuthenticatedSession,
    validarCredenciales,
    validarLogin,
    validarNuevoUsuario
} from '../app/Services/Auth.service.js';
import { esPeticionAjax, validarCsrfToken } from '../app/Helpers.js';

const password = 'Clave-Segura-26';

test('el registro normaliza el email y nunca acepta privilegios del cliente', () => {
    const user = validarNuevoUsuario({
        nombre: 'Usuario Seguro',
        email: ' USER@EXAMPLE.COM ',
        password,
        is_admin: '1',
        campo_desconocido: 'valor'
    });

    assert.equal(user.email, 'user@example.com');
    assert.equal(user.is_admin, false);
    assert.equal(Object.hasOwn(user, 'campo_desconocido'), false);
});

test('la validacion registra el detalle tecnico pero expone solo mensajes publicos', () => {
    const originalConsoleError = console.error;
    let technicalErrorLogged = false;
    console.error = () => {
        technicalErrorLogged = true;
    };

    try {
        let validationError;

        try {
            validarNuevoUsuario({
                email: 'user@example.com',
                password: 'clave-segura-26'
            });
        } catch (error) {
            validationError = error;
        }

        assert.equal(technicalErrorLogged, true);
        assert.ok(validationError);
        assert.match(validationError.message, /El nombre es obligatorio/);
        assert.match(validationError.message, /letra mayuscula/);
        assert.doesNotMatch(validationError.message, /Invalid input|expected string|undefined/i);
    } finally {
        console.error = originalConsoleError;
    }
});

test('el login valida y normaliza las credenciales', () => {
    const credentials = validarLogin({
        email: ' USER@EXAMPLE.COM ',
        password,
        carrito: [{ id: 1 }]
    });

    assert.deepEqual(credentials, {
        email: 'user@example.com',
        password
    });
});

test('la validacion de credenciales usa el mismo error para usuario o clave invalidos', async () => {
    const user = {
        password: await encrypt(password)
    };

    await assert.rejects(
        () => validarCredenciales('Clave-Incorrecta-2026', user),
        (error) => error.statusCode === 401 && error.message === 'Email o contraseña incorrectos'
    );

    await assert.rejects(
        () => validarCredenciales(password, undefined),
        (error) => error.statusCode === 401 && error.message === 'Email o contraseña incorrectos'
    );
});

test('la autenticacion regenera y guarda una sesion minima', async () => {
    const req = {};
    const regeneratedSession = {
        save(callback) {
            callback();
        }
    };

    req.session = {
        regenerate(callback) {
            req.session = regeneratedSession;
            callback();
        }
    };

    await setAuthenticatedSession(req, {
        id: 7,
        email: 'user@example.com',
        password: 'no-debe-guardarse',
        is_admin: 0,
        nombre: 'No debe guardarse'
    });

    assert.deepEqual(req.session.user, {
        id: 7,
        email: 'user@example.com',
        is_admin: false
    });
});

test('CSRF acepta header o formulario y compara contra la sesion', () => {
    const sessionToken = 'a'.repeat(64);
    const requestFromHeader = {
        session: { csrf_token: sessionToken },
        body: {},
        get(name) {
            return name === 'x-csrf-token' ? sessionToken : undefined;
        }
    };
    const requestFromForm = {
        session: { csrf_token: sessionToken },
        body: { csrf_token: sessionToken },
        get() {
            return undefined;
        }
    };

    assert.equal(validarCsrfToken(requestFromHeader), true);
    assert.equal(validarCsrfToken(requestFromForm), true);
    requestFromForm.body.csrf_token = 'b'.repeat(64);
    assert.equal(validarCsrfToken(requestFromForm), false);
});

test('AJAX se detecta mediante header, Accept o JSON', () => {
    const request = (headers) => ({
        xhr: false,
        get(name) {
            return headers[name.toLowerCase()];
        }
    });

    assert.equal(esPeticionAjax(request({ 'x-requested-with': 'XMLHttpRequest' })), true);
    assert.equal(esPeticionAjax(request({ accept: 'application/json' })), true);
    assert.equal(esPeticionAjax(request({ 'content-type': 'application/json' })), true);
    assert.equal(esPeticionAjax(request({ accept: 'text/html' })), false);
});
