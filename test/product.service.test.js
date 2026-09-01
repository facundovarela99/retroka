import assert from 'node:assert/strict';
import test from 'node:test';
import {
    validarNuevoProducto,
    validarProductoActualizacion
} from '../app/Services/Product.service.js';

test('el producto padre normaliza sus datos descriptivos', () => {
    const result = validarNuevoProducto({
        nombre:'remera urbana',
        descripcion:'molde para sus variantes',
        categoria:'2'
    });

    assert.deepEqual(result, {
        nombre:'Remera urbana',
        descripcion:'Molde para sus variantes',
        categoria:2
    });
});

test('el producto padre no acepta responsabilidades de una variante', () => {
    const result = validarNuevoProducto({
        nombre:'remera urbana',
        descripcion:'molde para sus variantes',
        categoria:'2',
        talle:'3',
        color:'Azul',
        stock:'12',
        precio:'19999.90',
        imagenes:['https://example.com/imagen.png']
    });

    assert.equal(result.talle, undefined);
    assert.equal(result.color, undefined);
    assert.equal(result.stock, undefined);
    assert.equal(result.precio, undefined);
    assert.equal(result.imagenes, undefined);
});

test('el producto padre requiere nombre y descripcion', () => {
    assert.throws(
        () => validarNuevoProducto({ categoria:'2' })
    );
});

test('la actualizacion solo normaliza nombre, descripcion y categoria', () => {
    const result = validarProductoActualizacion({
        nombre:'remera actualizada',
        descripcion:'nuevo molde',
        talle:'3',
        stock:'12',
        precio:'19999.90',
        categoria:'2'
    });

    assert.deepEqual(result, {
        nombre:'Remera actualizada',
        descripcion:'Nuevo molde',
        categoria:2
    });
});

test('la actualizacion acepta un body sin campos editables', () => {
    assert.deepEqual(
        validarProductoActualizacion({ id:'43', csrf_token:'token' }),
        {}
    );
});
