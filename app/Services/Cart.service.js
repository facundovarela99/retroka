import { AppError } from "../Models/Error.model.js";
import { ProductModel } from "../Models/Product.model.js";

export class CartService{

    #productModel

    constructor(){
        this.#productModel = new ProductModel();
    }

    validarCantidad(cantidad){
        const cantidadParseada = Number.parseInt(cantidad, 10);

        if (Number.isNaN(cantidadParseada)) {
            throw new AppError('Bad Request', 'La cantidad debe ser un numero valido', 400);
        }

        if (cantidadParseada < 0) {
            throw new AppError('Bad Request', 'La cantidad no puede ser menor a 0', 400);
        }

        return cantidadParseada;
    }

    async validarProductoParaAgregar(producto, cantidadEnCarrito = 0){
        const productId = Number(producto.id);
        const variantId = Number(producto.variante_id);

        if (!Number.isInteger(productId) || productId < 1) {
            throw new AppError('Bad Request', 'Producto invalido', 400);
        }

        if (!Number.isInteger(variantId) || variantId < 1) {
            throw new AppError('Bad Request', 'Debe seleccionar una variante del producto', 400);
        }

        const productoBase = await this.#productModel.findVariantByID(productId, variantId);
        const cantidadSolicitada = this.validarCantidad(producto.cantidad);
        const cantidadActual = this.validarCantidad(cantidadEnCarrito);
        const stock = this.validarCantidad(productoBase.stock);
        const precio = Number.parseFloat(productoBase.precio);

        if (cantidadSolicitada < 1) {
            throw new AppError('Bad Request', 'La cantidad debe ser mayor a 0', 400);
        }

        if (stock === 0) {
            throw new AppError('Conflict', `No hay stock disponible para ${productoBase.nombre}`, 409);
        }

        const stockDisponible = stock - cantidadActual;

        if (stockDisponible <= 0) {
            throw new AppError('Conflict', `No hay stock disponible para agregar mas unidades de ${productoBase.nombre}`, 409);
        }

        const cantidadPermitida = Math.min(cantidadSolicitada, stockDisponible);
        const total = Number((precio * cantidadPermitida).toFixed(2));
        const advertencia = cantidadPermitida < cantidadSolicitada
            ? `Solo se agregaron ${cantidadPermitida} unidad/es de ${productoBase.nombre} por stock disponible`
            : null;

        return {
            producto: {
                ...producto,
                id:productoBase.id,
                variante_id:productoBase.variante_id,
                nombre: productoBase.nombre,
                talle: productoBase.talle,
                color:productoBase.color,
                precio,
                cantidad: cantidadPermitida,
                total,
                stock
            },
            advertencia
        };
    }

    async cartData(carro){
        const productos = [];
        const advertencias = [];

        for (const producto of carro) {
            try {
                const productoValidado = await this.validarProductoParaAgregar(producto);
                productos.push(productoValidado.producto);

                if (productoValidado.advertencia) {
                    advertencias.push(productoValidado.advertencia);
                }
            } catch (error) {
                if (error.statusCode === 409) {
                    advertencias.push(error.message);
                    continue;
                }

                throw error;
            }
        }

        if (productos.length === 0) {
            throw new AppError('Conflict', advertencias.join('. ') || 'No hay stock disponible', 409);
        }

        const cantidadProductos = productos.reduce((total, producto) => total + producto.cantidad, 0);
        const subtotalCompra = productos.reduce((total, producto) => total + producto.total, 0);

    
        const carrito = {};
    
        carrito['productos'] = productos;
        carrito['cantidad'] = cantidadProductos;
        carrito['subtotal'] = subtotalCompra;
        carrito['advertencias'] = advertencias;

        return carrito;
    }
    
}
