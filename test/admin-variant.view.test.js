import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import ejs from 'ejs';

const createViewPath = path.resolve('public/views/admin/variant/create.ejs');
const editViewPath = path.resolve('public/views/admin/variant/edit.ejs');
const productViewPath = path.resolve('public/views/admin/products/product.ejs');
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
    color:'Azul marino',
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
    form_data:{},
    imagenes:[]
};

test('la vista de alta envia color y varias imagenes para la variante', async () => {
    const html = await ejs.renderFile(createViewPath, commonLocals, {
        filename:createViewPath
    });

    assert.match(html, /action="\/retroka\/admin\/productos\/43\/variantes"/);
    assert.match(html, /name="csrf_token" value="csrf-token"/);
    assert.match(html, /name="producto_id" value="43"/);
    assert.match(html, /name="talle"/);
    assert.match(html, /name="color"/);
    assert.match(html, /name="stock"/);
    assert.match(html, /name="precio"/);
    assert.match(html, /enctype="multipart\/form-data"/);
    assert.match(html, /type="file"/);
    assert.match(html, /name="imagenes"/);
    assert.match(html, /multiple/);
});

test('la vista de edicion identifica producto y variante', async () => {
    const html = await ejs.renderFile(editViewPath, {
        ...commonLocals,
        variante,
        imagenes:[{
            id:12,
            url:'/uploads/43/variants/8/azul.jpg',
            nombre_original:'azul.jpg'
        }]
    }, { filename:editViewPath });

    assert.match(html, /action="\/retroka\/admin\/productos\/43\/variantes\/8"/);
    assert.match(html, /name="producto_id" value="43"/);
    assert.match(html, /name="variante_id" value="8"/);
    assert.match(html, /name="color"/);
    assert.match(html, /value="Azul marino"/);
    assert.match(html, /enctype="multipart\/form-data"/);
    assert.match(html, /name="eliminar_imagenes"/);
    assert.match(html, /name="imagenes"/);
    assert.match(html, /\/variantes\/8\/eliminar/);
});

test('el detalle del producto enlaza la nueva variante y sus acciones', async () => {
    const html = await ejs.renderFile(productViewPath, {
        ...commonLocals,
        variantes:[{
            ...variante,
            imagenes:[
                {
                    id:12,
                    variante_id:8,
                    url:'/uploads/43/variants/8/frente.jpg',
                    nombre_original:'frente.jpg'
                },
                {
                    id:13,
                    variante_id:8,
                    url:'/uploads/43/variants/8/dorso.jpg',
                    nombre_original:'dorso.jpg'
                }
            ]
        }],
        carrito:[]
    }, { filename:productViewPath });

    assert.match(html, /\/admin\/productos\/43\/variantes\/nueva/);
    assert.match(html, /Nueva variante/);
    assert.match(html, /\/admin\/productos\/43\/variantes\/8\/editar/);
    assert.match(html, /\/admin\/productos\/43\/variantes\/8\/eliminar/);
    assert.match(html, /id="variant-images-8"/);
    assert.match(html, /\/variants\/8\/frente\.jpg/);
    assert.match(html, /\/variants\/8\/dorso\.jpg/);
    assert.match(html, /data-bs-slide="next"/);
});

test('la tienda separa la seleccion de color y talle', async () => {
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
            },
            {
                ...variante,
                variante_id:10,
                color:'Verde',
                talle_id:3,
                talle:'L',
                stock:0
            }
        ],
        carrito:[],
        url,
        baseUrl:'/retroka',
        csrf_token:'csrf-token'
    }, { filename:storefrontProductViewPath });

    assert.match(html, /class="product-color-button"/);
    assert.match(html, /data-color="Azul marino"/);
    assert.match(html, /data-color="Verde"/);
    assert.match(html, /data-talle="XXL"/);
    assert.match(html, /id="product-variants-data"/);
    assert.match(html, /data-producto=""/);
});
