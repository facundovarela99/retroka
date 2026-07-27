import { CartModel } from "../Models/Cart.model.js";
import { ProductModel } from "../Models/Product.model.js";
import { CartService } from "../Services/Cart.service.js";


class CartController{
    #cartModel;
    #productModel;
    #cartService;

    constructor(){
        this.#cartModel = new CartModel();
        this.#productModel = new ProductModel();
        this.#cartService = new CartService();
    }

    async getCart(req, res){
        const user = req.session.user;

        const carrito = await this.#cartModel.getUserCart(user.id);

        return res.status(200).json({
            carrito: carrito
        }) 
    }

    async create(req, res, login){
        const user = req.session.user;

        try {
            //Evaluar casos donde venga uno o varios productos
            const carro = req.body.carrito;
            const carrito = await this.#cartService.cartData(carro);

            await this.#cartModel.createUserCart(user.id, carrito);

            if (login!==true){
                return res.status(200).json({
                    status:'success',
                    data:true,
                    message:'Carrito creado'
                });
            }
        
            
        } catch (error) {
            if (login===true) throw error;

            return res.status(error.statusCode || 500).json({
                data: null,
                error: error.error || 'Internal Server Error',
                message: error.message,
                status: error.statusCode || 500
            });
        }
    }

    async update(req, res, login){
        const user = req.session.user;
        const carro = req.body.carrito;

        const cart = await this.#cartModel.getUserCart(user.id);

        try {
            if (cart.length === 0) {
                const carrito = await this.#cartService.cartData(carro);
                await this.#cartModel.createUserCart(user.id, carrito);

                if (login!==true){
                    return res.status(200).json({
                        status:'success',
                        data:true,
                        message:'Carrito creado'
                    });
                }

                return true;
            }

            const userCartID = await this.#cartModel.getUserCartId(user.id);

            for (const producto of carro) {
                const productoEnCarrito = await this.#cartModel.getProductInCart(producto.id, user.id)
                if (productoEnCarrito){
                    var cantidadProducto = producto.cantidad + productoEnCarrito.cantidad;
                    var subtotalProducto = producto.total+ parseFloat(productoEnCarrito.total);
                    await this.#cartModel.updateProductInCart(producto, userCartID, cantidadProducto, subtotalProducto);
                } 
                else {
                    await this.#cartModel.updateUserCart(producto, userCartID)
                }
            }

            if (login!==true){
                return res.status(200).json({
                    status:'success',
                    data:true,
                    message:'Carrito actualizado'
                });
            }
            
        } catch (error) {
            if (login===true) throw error;

            return res.status(error.statusCode || 500).json({
                data: null,
                error: error.error || 'Internal Server Error',
                message: error.message,
                status: error.statusCode || 500
            });
        }
    }

    async delete(req, res){
        const user = req.session.user;

        const carro = await this.#cartModel.getUserCart(user.id);

        if (!carro ?? carro.length === 0){
            return res.status(404).json({
                message:'Carro inexistente'
            });
        }

        try {
            await this.#cartModel.deleteUserCart(user.id);

            return res.status(200).json({
                status:'success',
                message:'Carrito vaciado'
            });
        } catch (error) {
            return res.status(error.statusCode || 500).json({
                data: null,
                error: error.error || 'Internal Server Error',
                message: error.message,
                status: error.statusCode || 500
            });
        }
        }



    // async get(req, res){
    //     const user = req.session.user;

    //     const carrito = 
    // }
}


export const cartController = new CartController();
