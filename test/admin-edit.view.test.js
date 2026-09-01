import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import ejs from 'ejs';

const viewPath = path.resolve('public/views/admin/products/edit.ejs');

test('la edicion del producto envia solo los datos del padre', async () => {
    const html = await ejs.renderFile(viewPath, {
        title:'Editar producto',
        user:{ email:'admin@retroka.test' },
        producto:{
            id:43,
            nombre:'Remera Oversize',
            descripcion:'Molde de remera',
            categoria:2
        },
        categorias:[{ id:2, nombre:'Remeras' }],
        url:(route = '') => `/retroka${route}`,
        baseUrl:'/retroka',
        csrf_token:'csrf-token',
        product_message:null,
        form_data:{}
    }, { filename:viewPath });

    assert.match(html, /action="\/retroka\/admin\/productos\/actualizar"/);
    assert.match(html, /name="id" value="43"/);
    assert.match(html, /name="csrf_token" value="csrf-token"/);
    assert.match(html, /name="nombre"/);
    assert.match(html, /name="descripcion"/);
    assert.match(html, /name="categoria"/);
    assert.doesNotMatch(html, /name="variante_id"/);
    assert.doesNotMatch(html, /name="stock"/);
    assert.doesNotMatch(html, /name="precio"/);
    assert.doesNotMatch(html, /name="imagenes"/);
    assert.doesNotMatch(html, /multipart\/form-data/);
});
