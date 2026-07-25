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

    async cartData(carro){
        const productos = await Promise.all(carro.map(async (producto)=>{
            await this.#productModel.findByID(producto.id);
            return {
                ...producto,
                cantidad: this.validarCantidad(producto.cantidad)
            };
        }));

        const cantidadProductos = productos.reduce((total, producto) => total + producto.cantidad, 0);
        const subtotalCompra = productos.reduce((total, producto) => total + producto.total, 0);

    
        const carrito = {};
    
        carrito['productos'] = productos;
        carrito['cantidad'] = cantidadProductos;
        carrito['subtotal'] = subtotalCompra;

        return carrito;
    }
    
}
