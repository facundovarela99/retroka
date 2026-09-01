import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { uploadProductImages } from '../app/Middleware/Upload.middleware.js';

const listen = (app) => new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
    server.once('error', reject);
});

const close = (server) => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
});

test('el middleware recibe color y varias imagenes para una variante', async (context) => {
    const app = express();

    app.post('/admin/productos/:productId/variantes', uploadProductImages, (req, res) => {
        res.set('Connection', 'close');

        return res.status(200).json({
            productoId:req.params.productId,
            color:req.body.color,
            cantidad:req.files.length,
            nombres:req.files.map((file) => file.originalname)
        });
    });

    app.use((error, _req, res, _next) => {
        return res.status(error.statusCode || 500).json({ message:error.message });
    });

    const server = await listen(app);
    context.after(() => close(server));

    const address = server.address();
    const formData = new FormData();
    formData.append('color', 'Azul marino');
    formData.append('imagenes', new Blob(['frente'], { type:'image/jpeg' }), 'frente.jpg');
    formData.append('imagenes', new Blob(['dorso'], { type:'image/png' }), 'dorso.png');

    const response = await fetch(
        `http://127.0.0.1:${address.port}/admin/productos/43/variantes`,
        { method:'POST', body:formData }
    );
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.productoId, '43');
    assert.equal(result.color, 'Azul marino');
    assert.equal(result.cantidad, 2);
    assert.deepEqual(result.nombres, ['frente.jpg', 'dorso.png']);
});
