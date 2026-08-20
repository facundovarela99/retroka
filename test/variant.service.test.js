import assert from 'node:assert/strict';
import test from 'node:test';
import {
    validarActualizacionVariante,
    validarNuevaVariante
} from '../app/Services/Variant.service.js';

test('la variante nueva normaliza producto, talle, stock y precio', () => {
    assert.deepEqual(
        validarNuevaVariante({
            producto_id:'43',
            talle:'2',
            stock:'8',
            precio:'24999.90'
        }),
        {
            producto_id:43,
            talle:2,
            stock:8,
            precio:24999.9
        }
    );
});

test('la variante rechaza stock decimal y precio con mas de dos decimales', () => {
    assert.throws(
        () => validarNuevaVariante({
            producto_id:'43',
            talle:'2',
            stock:'1.5',
            precio:'24999.999'
        }),
        /stock debe ser un numero entero|precio puede tener hasta dos decimales/
    );
});

test('la actualizacion de variante permite no modificar campos', () => {
    assert.deepEqual(
        validarActualizacionVariante({
            producto_id:'43',
            variante_id:'8',
            csrf_token:'token'
        }),
        {}
    );
});
