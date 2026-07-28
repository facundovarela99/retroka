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
            const resultado = {
                status:'success',
                data:true,
                message: carrito.advertencias.length > 0 ? carrito.advertencias.join('. ') : 'Carrito creado',
                productos: carrito.productos,
                advertencias: carrito.advertencias
            };

            if (login!==true){
                return res.status(200).json(resultado);
            }

            return resultado;
        
            
        } catch (error) {
            if (login===true && error.statusCode === 409) {
                return {
                    status:'error',
                    data:false,
                    message: error.message,
                    advertencias: [error.message]
                };
            }

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
                const resultado = {
                    status:'success',
                    data:true,
                    message: carrito.advertencias.length > 0 ? carrito.advertencias.join('. ') : 'Carrito creado',
                    productos: carrito.productos,
                    advertencias: carrito.advertencias
                };

                if (login!==true){
                    return res.status(200).json(resultado);
                }

                return resultado;
            }

            const userCartID = await this.#cartModel.getUserCartId(user.id);
            const productosProcesados = [];
            const advertencias = [];

            for (const producto of carro) {
                const productoEnCarrito = await this.#cartModel.getProductInCart(producto.id, user.id)
                let productoValidado;

                try {
                    const resultadoValidacion = await this.#cartService.validarProductoParaAgregar(
                        producto,
                        productoEnCarrito?.cantidad || 0
                    );

                    productoValidado = resultadoValidacion.producto;

                    if (resultadoValidacion.advertencia) {
                        advertencias.push(resultadoValidacion.advertencia);
                    }
                } catch (error) {
                    if (error.statusCode === 409) {
                        advertencias.push(error.message);
                        continue;
                    }

                    throw error;
                }

                if (productoEnCarrito){
                    var cantidadProducto = productoValidado.cantidad + productoEnCarrito.cantidad;
                    var subtotalProducto = parseFloat(productoValidado.total)+ parseFloat(productoEnCarrito.total);
                    await this.#cartModel.updateProductInCart(productoValidado, userCartID, cantidadProducto, subtotalProducto);
                } 
                else {
                    await this.#cartModel.updateUserCart(productoValidado, userCartID)
                }

                productosProcesados.push(productoValidado);
            }

            if (productosProcesados.length === 0) {
                const resultado = {
                    status:'error',
                    data:false,
                    message: advertencias.join('. ') || 'No hay stock disponible',
                    advertencias
                };

                if (login!==true){
                    return res.status(409).json(resultado);
                }

                return resultado;
            }

            const resultado = {
                status:'success',
                data:true,
                message: advertencias.length > 0 ? advertencias.join('. ') : 'Carrito actualizado',
                productos: productosProcesados,
                advertencias
            };

            if (login!==true){
                return res.status(200).json(resultado);
            }

            return resultado;
            
        } catch (error) {
            if (login===true && error.statusCode === 409) {
                return {
                    status:'error',
                    data:false,
                    message: error.message,
                    advertencias: [error.message]
                };
            }

            if (login===true) throw error;

            return res.status(error.statusCode || 500).json({
                data: null,
                error: error.error || 'Internal Server Error',
                message: error.message,
                status: error.statusCode || 500
            });
        }
    }

    async remove(req, res){
        const user = req.session.user;
        const productId = parseInt(req.body.id, 10);
        const eliminarProducto = req.body.eliminar === true || req.body.eliminar === 'true';

        if (Number.isNaN(productId)) {
            return res.status(400).json({
                message:'Producto invalido'
            });
        }

        const carro = await this.#cartModel.getUserCart(user.id);

        if (!carro || carro.length === 0){
            return res.status(404).json({
                message:'Carro inexistente'
            });
        }

        try {

            var message = "";
            const producto = carro.find((prod)=>prod.id === productId);

            if (!producto) {
                return res.status(404).json({
                    message:'Producto inexistente en el carrito'
                });
            }


            if (eliminarProducto) {
                if (carro.length > 1){
                    await this.#cartModel.removeProduct(productId, user.id);
                    message = 'Producto eliminado';
                } else {
                    await this.#cartModel.deleteUserCart(user.id);
                    message = 'Carrito vaciado';
                }
            } else if (producto.cantidad > 1){
                await this.#cartModel.subtractProduct(productId, user.id);
                message = 'Producto actualizado';
            } else if (producto.cantidad === 1){
                if (carro.length > 1){
                    await this.#cartModel.removeProduct(productId, user.id);
                    message = 'Producto eliminado'
                } else if (carro.length === 1) {
                    await this.#cartModel.deleteUserCart(user.id);
                    message = 'Carrito vaciado';
                }
            }

            return res.status(200).json({
                status:'success',
                message:message
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

    async delete(req, res){
        const user = req.session.user;

        const carro = await this.#cartModel.getUserCart(user.id);

        if (!carro || carro.length === 0){
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
