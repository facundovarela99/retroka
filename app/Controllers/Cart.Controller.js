import { CartModel } from "../Models/Cart.model.js";
import { ProductModel } from "../Models/Product.model.js";
import { validarCantidad } from "../Services/Cart.service.js";


class CartController{
    #cartModel;
    #productModel;

    constructor(){
        this.#cartModel = new CartModel();
        this.#productModel = new ProductModel();
    }

    async create(req, res, login){
        const user = req.session.user;

        //Evaluar casos donde venga uno o varios productos

        const carro = req.body.carrito;

        let cantidadProductos = 0;
        let subtotalCompra = 0;
        const productos = [];


        carro.forEach((producto)=>{
            this.#productModel.findByID(producto.id);
            cantidadProductos+=producto.cantidad;
            subtotalCompra+=producto.total;
            productos.push(producto);
        });

        const carrito = {};

        carrito['productos'] = productos;
        carrito['cantidad'] = cantidadProductos;
        carrito['subtotal'] = subtotalCompra;

        try {

            this.#cartModel.createUserCart(user.id, carrito);

            if (login!==true){
                res.status(200).json({
                    status:'success',
                    data:true,
                    message:'Carrito creado'
                });
            }
        
            
        } catch (error) {
            return res.status(error.statusCode || 500).json({
                data: null,
                error: error.error || 'Internal Server Error',
                message: error.message,
                status: error.statusCode || 500
            });
        }
    }

    async update(req, res){

    }

    // async get(req, res){
    //     const user = req.session.user;

    //     const carrito = 
    // }
}


export const cartController = new CartController();

