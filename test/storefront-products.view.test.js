import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import ejs from 'ejs';

const viewPath = path.resolve('public/views/site/productos.ejs');

test('el catalogo muestra la primera imagen de cada variante', async () => {
    const html = await ejs.renderFile(viewPath, {
        title:'Productos',
        user:null,
        productos:[{
            id:43,
            nombre:'Remera Oversize',
            descripcion:'Molde de remera',
            categoria:2,
            categoria_producto:'Remeras',
            stock:8,
            cantidad_variantes:2,
            variantes:[
                {
                    variante_id:8,
                    color:'Azul',
                    talle:'M',
                    imagen_archivo:'/uploads/43/variants/8/azul.jpg'
                },
                {
                    variante_id:9,
                    color:'Verde',
                    talle:'L',
                    imagen_archivo:'/uploads/43/variants/9/verde.jpg'
                }
            ]
        }],
        carrito:[],
        url:(route = '') => `/retroka${route}`,
        baseUrl:'/retroka',
        csrf_token:'csrf-token',
        product_message:null,
        auth_message:null
    }, { filename:viewPath });

    assert.match(html, /product-variant-preview-grid/);
    assert.match(html, /\/variants\/8\/azul\.jpg/);
    assert.match(html, /\/variants\/9\/verde\.jpg/);
    assert.match(html, /Azul, talle M/);
    assert.match(html, /Verde, talle L/);
});
