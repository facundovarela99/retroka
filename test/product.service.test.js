import assert from 'node:assert/strict';
import test from 'node:test';
import { validarNuevoProducto } from '../app/Services/Product.service.js';

const validProduct = {
    nombre: 'remera urbana',
    descripcion: 'remera de prueba',
    talle: '2',
    stock: '5',
    precio: '1250.50',
    categoria: '1',
    imagenes: ['/uploads/42/550e8400-e29b-41d4-a716-446655440000.png']
};

test('el producto nuevo normaliza numeros y acepta varias URLs internas', () => {
    const result = validarNuevoProducto({
        ...validProduct,
        imagenes: [
            validProduct.imagenes[0],
            '/uploads/42/6ba7b810-9dad-41d1-80b4-00c04fd430c8.jpg'
        ]
    });

    assert.equal(result.talle, 2);
    assert.equal(result.stock, 5);
    assert.equal(result.precio, 1250.5);
    assert.equal(result.categoria, 1);
    assert.equal(result.imagenes.length, 2);
});

test('el producto nuevo rechaza URLs externas o fuera de uploads', () => {
    assert.throws(
        () => validarNuevoProducto({
            ...validProduct,
            imagenes: ['https://example.com/imagen.png']
        }),
        /directorio de productos/
    );
});

test('el producto nuevo limita la cantidad de imagenes', () => {
    assert.throws(
        () => validarNuevoProducto({
            ...validProduct,
            imagenes: Array.from(
                { length: 9 },
                (_, index) => `/uploads/42/550e8400-e29b-41d4-a716-44665544000${index}.png`
            )
        }),
        /hasta 8 imagenes/
    );
});
