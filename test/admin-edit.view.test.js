import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import ejs from 'ejs';

const viewPath = path.resolve('public/views/admin/edit.ejs');

test('la vista de edicion envia producto, CSRF e imagenes al endpoint de actualizacion', async () => {
    const html = await ejs.renderFile(viewPath, {
        title:'Editar producto',
        user:{ email:'admin@retroka.test' },
        producto:{
            id:43,
            nombre:'Remera Oversize',
            stock:10,
            precio:'30000.00',
            categoria:2
        },
        variantes:[{
            variante_id:6,
            talle_id:5,
            talle:'XL',
            stock:10,
            precio:'30000.00'
        }],
        imagenes:[{
            id:2,
            url:'/uploads/43/test.png',
            nombre_original:'test.png'
        }],
        talles:[{ id:5, tipo:'XL' }],
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
    assert.match(html, /name="variante_id" value="6"/);
    assert.match(html, /src="\/uploads\/43\/test\.png"/);
    assert.match(html, /name="eliminar_imagenes"/);
    assert.match(html, /name="imagenes"/);
});
