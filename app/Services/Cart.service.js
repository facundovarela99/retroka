import { normalize, string } from "zod";
import { ProductModel } from "../Models/Product.model.js";

export class CartService{

    #productModel

    constructor(){
        this.#productModel = new ProductModel();
    }

    validarCantidad(cantidad){
        let normalized = "";
        if (typeof cantidad === 'string'){
            for (const str of cantidad) {
                if (str !== "" || str !== " "){
                    normalized+=str
                } 
            }
        }
        return parseInt(normalized.trim());
    }
    
    
    async cartData(carro){
        const productos = await Promise.all(carro.map(async (producto)=>{
            await this.#productModel.findByID(producto.id);
            return producto;
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
