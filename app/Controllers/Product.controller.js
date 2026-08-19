import { CategoryModel } from "../Models/Category.model.js";
import { ProductModel } from "../Models/Product.model.js"
import { validarNuevoProducto, validarProductoActualizacion } from "../Services/Product.service.js";
import { AppError } from "../Models/Error.model.js";
import { base_path, url } from "../Config/Env.js";
import { CartModel } from "../Models/Cart.model.js";
import { FileModel } from "../Models/File.model.js";
import { obtenerCsrfToken, esPeticionAjax } from "../Helpers.js";
import { validateFile } from "secure-file-validator";
import { MAX_PRODUCT_IMAGE_SIZE } from "../Middleware/Upload.middleware.js";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PRODUCT_UPLOADS_ROOT = path.resolve(__dirname, '../../public/uploads');
const MIME_TYPE_BY_EXTENSION = new Map([
    ['.jpg', 'image/jpeg'],
    ['.jpeg', 'image/jpeg'],
    ['.png', 'image/png'],
    ['.gif', 'image/gif'],
    ['.svg', 'image/svg+xml']
]);

const consumeProductMessage = (req) => {
    const message = req.session?.product_message || null;

    if (req.session?.product_message) {
        delete req.session.product_message;
    }

    return message;
};

const productUploadDirectory = (productId) => {
    if (!Number.isInteger(Number(productId)) || Number(productId) < 1) {
        throw new AppError('Internal Server Error', 'Id de producto invalido para almacenar imagenes', 500);
    }

    const directory = path.resolve(PRODUCT_UPLOADS_ROOT, String(productId));

    if (path.dirname(directory) !== PRODUCT_UPLOADS_ROOT) {
        throw new AppError('Internal Server Error', 'Directorio de imagenes invalido', 500);
    }

    return directory;
};

const removeProductUploadDirectory = async (productId) => {
    const directory = productUploadDirectory(productId);
    await fs.rm(directory, { recursive: true, force: true });
};

const validateAndStoreProductImages = async (files, productId) => {
    if (!Array.isArray(files) || files.length === 0) {
        return [];
    }

    for (const file of files) {
        const validation = await validateFile(file.path, {
            maxSizeInBytes: MAX_PRODUCT_IMAGE_SIZE
        });

        if (!validation.status) {
            throw new AppError(
                'Bad Request',
                `La imagen ${file.originalname} no es valida: ${validation.message}`,
                400
            );
        }
    }

    const directory = productUploadDirectory(productId);
    await fs.mkdir(directory, { recursive: true });

    try {
        const storedFiles = [];

        for (const file of files) {
            const filename = path.basename(file.filename);
            const extension = path.extname(filename).toLowerCase();
            const mimeType = MIME_TYPE_BY_EXTENSION.get(extension);

            if (!mimeType) {
                throw new AppError('Bad Request', `Formato de imagen no permitido: ${file.originalname}`, 400);
            }

            const destination = path.join(directory, filename);
            await fs.rename(file.path, destination);

            storedFiles.push({
                url: `/uploads/${productId}/${filename}`,
                nombre: filename,
                nombre_original: path.basename(file.originalname.replaceAll('\\', '/')),
                mime_type: mimeType,
                size: file.size
            });
        }

        return storedFiles;
    } catch (error) {
        await removeProductUploadDirectory(productId);
        throw error;
    }
};


export class ProductController{

    #productModel
    #categoryController
    #cartModel
    #fileModel

    constructor(){
        this.#productModel = new ProductModel();
        this.#categoryController = new CategoryModel();
        this.#cartModel = new CartModel();
        this.#fileModel = new FileModel();
    }

    async getAll(req, res, next){
        try {
            const user = req.session.user;
            const productos = await this.#productModel.getAll();
            const productMessage = consumeProductMessage(req);
            var carritoUsuario = [];

            if (user){
                carritoUsuario = await this.#cartModel.getUserCart(user.id);
            }

            res.status(200).render('productos',{
                user:user,
                title: 'Productos',
                productos:productos,
                carrito:carritoUsuario,
                url:url,
                baseUrl:base_path(),
                csrf_token:obtenerCsrfToken(req),
                product_message:productMessage
            })
        } catch (error) {
            return next(error);
        }
    }

    async create(req, res, next){
        try {
            const productMessage = consumeProductMessage(req);
            const formData = req.session?.product_form_data || {};

            if (req.session?.product_form_data) {
                delete req.session.product_form_data;
            }

            return res.render('create', {
                title:'Crear producto',
                url:url,
                csrf_token: obtenerCsrfToken(req),
                talles: await this.#productModel.getTalles(),
                categorias: await this.#categoryController.getAll(),
                product_message:productMessage,
                form_data:formData
            });
        } catch (error) {
            return next(error);
        }
    }

    async product(req, res, next){
        const id = req.params.id;

        try {
            const user = req.session.user;
        
            if (!id) throw new AppError('Not Found', 'Producto inexistente', 404);
        
            const producto = await this.#productModel.findByID(id);
            const variantes = await this.#productModel.findVariants(producto);

            var carritoUsuario = []

            if (user){
                carritoUsuario = await this.#cartModel.getUserCart(user.id);
            }

            res.status(200).render('producto', {
                user:user,
                title:producto.nombre,
                producto:producto,
                variantes:variantes,
                carrito:carritoUsuario,
                url:url,
                baseUrl:base_path(),
                csrf_token:obtenerCsrfToken(req)
            })

        } catch (error) {
            return next(error);
        }
    }

    async store(req, res, next){
        let createdProductId = null;
        let formData = null;

        try{
            formData = {
                nombre: req.body.nombre,
                descripcion: req.body.descripcion,
                talle: req.body.talle,
                stock: req.body.stock,
                precio: req.body.precio,
                categoria: req.body.categoria,
                imagenes: []
            };

            const producto = validarNuevoProducto(formData);

            if (req.body.categoria){
                const categoria = await this.#categoryController.findByID(req.body.categoria);

                if (!categoria) {
                    throw new AppError('Bad Request', 'La categoria seleccionada no existe', 400);
                }

                producto.categoria = categoria.id;
            }

            const result = await this.#productModel.create(producto);
            createdProductId = result.id;

            const storedImages = await validateAndStoreProductImages(req.files, result.id);
            const productWithImages = validarNuevoProducto({
                ...producto,
                imagenes: storedImages.map((file) => file.url)
            });
            const insertedImages = await this.#fileModel.createMany(result.id, storedImages);

            req.session.product_message = {
                type: 'success',
                message: 'Producto creado exitosamente'
            };


            if (esPeticionAjax(req)) {
                return res.status(201).json({
                    data: {
                        ...result,
                        imagenes: insertedImages,
                        urls: productWithImages.imagenes
                    },
                    message: 'Producto creado exitosamente',
                    redirectTo: '/retroka/productos'
                });
            }

            return res.redirect(303, '/retroka/productos');
        } catch(error){
            if (createdProductId) {
                try {
                    await removeProductUploadDirectory(createdProductId);
                    await this.#productModel.delete(createdProductId);
                } catch (rollbackError) {
                    console.error('No se pudo revertir el producto luego de un error de imagenes:', rollbackError);
                }
            }

            const status = Number.isInteger(error?.statusCode) ? error.statusCode : 500;

            if (esPeticionAjax(req)) {
                return next(error);
            }

            if (status >= 500) {
                console.error('Error interno al crear un producto:', error);
            }

            req.session.product_message = {
                type: 'error',
                message: status >= 500
                    ? 'No se pudo crear el producto. Intenta nuevamente.'
                    : error.message
            };
            req.session.product_form_data = formData;

            return res.redirect(303, '/retroka/productos/nuevo');
        }
    }


    async update(req, res){
        const id = req.body.id;
        try {

            if (!id) throw new AppError('Not Found', 'Producto inexistente', 404);
        
            await this.#productModel.findByID(id);

            const producto = validarProductoActualizacion(req.body);

            if (req.body.categoria){
                
                const categoria = await this.#categoryController.findByID(req.body.categoria);
                const productoDeBase = this.#productModel.findByID(id);

                if (categoria !== undefined){
                    producto.categoria = categoria;
                } else if (productoDeBase.categoria !== null){
                    producto.categoria = productoDeBase.categoria;
                }
                
            }

            // Logica para actualizar las imágenes
            // ......
            // Logica para actualizar las imágenes

            await this.#productModel.update(id, producto);

            res.status(200).json({
                data:producto,
                id:id,
                message:'Producto actualizado con éxito'
            })
        } catch (error) {
            res.status(500).json({
                message: error.message
            })
        }
    }

    async delete(req, res){
        const id = req.body.id;
        try{

            await this.#productModel.findByID(id);

            await this.#productModel.delete(id);
            
            res.status(200).json({
                message:'Producto eliminado exitosamente'
            })
        } catch(error){
            res.status(error.statusCode).json({
                error:error.error,
                message: error.message
            })
        }
    }
}

export const productController = new ProductController();
