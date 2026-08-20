import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import ejs from 'ejs';

const createViewPath = path.resolve('public/views/admin/variant/create.ejs');
const editViewPath = path.resolve('public/views/admin/variant/edit.ejs');
const productViewPath = path.resolve('public/views/admin/producto.ejs');
const storefrontProductViewPath = path.resolve('public/views/site/producto.ejs');
const url = (route = '') => `/retroka${route}`;
const producto = {
    id:43,
    nombre:'Remera Oversize',
    descripcion:'Remera urbana',
    stock:10,
    precio:'30000.00',
    categoria:2,
    categoria_producto:'Remeras',
    imagen_archivo:'/uploads/43/product.png'
};
const variante = {
    variante_id:8,
    producto_id:43,
    talle_id:2,
    talle:'M',
    stock:8,
    precio:'24999.90',
    activo:1
};
const commonLocals = {
    title:'Variante',
    user:{ email:'admin@retroka.test' },
    producto,
    talles:[
        { id:1, tipo:'S' },
        { id:2, tipo:'M' },
        { id:3, tipo:'L' }
    ],
    variantes:[variante],
    url,
    baseUrl:'/retroka',
    csrf_token:'csrf-token',
    product_message:null,
    form_data:{}
};

test('la vista de alta crea una variante sin enviar imagenes', async () => {
    const html = await ejs.renderFile(createViewPath, commonLocals, {
        filename:createViewPath
    });

    assert.match(html, /action="\/retroka\/admin\/productos\/43\/variantes"/);
    assert.match(html, /name="csrf_token" value="csrf-token"/);
    assert.match(html, /name="producto_id" value="43"/);
    assert.match(html, /name="talle"/);
    assert.match(html, /name="stock"/);
    assert.match(html, /name="precio"/);
    assert.doesNotMatch(html, /type="file"/);
});

test('la vista de edicion identifica producto y variante', async () => {
    const html = await ejs.renderFile(editViewPath, {
        ...commonLocals,
        variante
    }, { filename:editViewPath });

    assert.match(html, /action="\/retroka\/admin\/productos\/43\/variantes\/8"/);
    assert.match(html, /name="producto_id" value="43"/);
    assert.match(html, /name="variante_id" value="8"/);
    assert.match(html, /\/variantes\/8\/eliminar/);
    assert.doesNotMatch(html, /type="file"/);
});

test('el detalle del producto enlaza la nueva variante y sus acciones', async () => {
    const html = await ejs.renderFile(productViewPath, {
        ...commonLocals,
        imagenes:[],
        carrito:[]
    }, { filename:productViewPath });

    assert.match(html, /\/admin\/productos\/43\/variantes\/nueva/);
    assert.match(html, /Nueva variante/);
    assert.match(html, /\/admin\/productos\/43\/variantes\/8\/editar/);
    assert.match(html, /\/admin\/productos\/43\/variantes\/8\/eliminar/);
});

test('la tienda muestra talles agregados que no estaban en la lista base', async () => {
    const html = await ejs.renderFile(storefrontProductViewPath, {
        title:producto.nombre,
        user:null,
        producto,
        variantes:[
            variante,
            {
                ...variante,
                variante_id:9,
                talle_id:5,
                talle:'XXL',
                stock:3
            }
        ],
        carrito:[],
        url,
        baseUrl:'/retroka',
        csrf_token:'csrf-token'
    }, { filename:storefrontProductViewPath });

    assert.match(html, /data-talle="XXL"/);
    assert.match(html, /Talle XXL: 3 disponibles/);
});
