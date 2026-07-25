import { pool } from "../Config/Database.js";
import { AppError } from "./Error.model.js";


export class CartModel{
 
    #tables = {carritos:'carritos', carritos_x_productos:'carritos_x_productos', carritos_x_usuarios:'carritos_x_usuarios'};

    async getUserCartId(userId){
        const [row] = await pool.execute(
            `SELECT cu.carrito_id FROM ${this.#tables.carritos} c 
            JOIN carritos_x_usuarios cu 
            ON c.id = cu.carrito_id
            WHERE cu.usuario_id = ?;`,[userId]
        );

        return row[0].carrito_id;
    }

    async getUserCart(userId) {
        const [rows] = await pool.execute(
            `SELECT p.id, p.nombre, p.precio, cp.cantidad, cp.total FROM ${this.#tables.carritos} c
            JOIN ${this.#tables.carritos_x_productos} cp
            ON c.id = cp.carrito_id
            JOIN productos p
            ON cp.producto_id = p.id
            JOIN ${this.#tables.carritos_x_usuarios} cu
            ON c.id = cu.carrito_id
            WHERE cu.usuario_id = ?;`,[userId]
        );


        return rows;
    }

    async createUserCart(userId, carrito){
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            const [result] =  await connection.execute(
                `INSERT INTO ${this.#tables.carritos} (cantidad_productos, subtotal) VALUES (?,?);`,[carrito.cantidad, carrito.subtotal]
            );

            const lastInsertId = result.insertId; 


            for (const producto of carrito.productos) {
                await connection.execute(
                    `INSERT INTO ${this.#tables.carritos_x_productos} VALUES (?,?,?,?);`,[lastInsertId, producto.id, producto.cantidad, producto.total]
                );
            }

            await connection.execute(
                `INSERT INTO ${this.#tables.carritos_x_usuarios} VALUES (?,?);`,[lastInsertId, userId]
            );

            await connection.commit();
            
        } catch (error) {
            if (connection) await connection.rollback();
            throw new AppError('Internal Server Error', error.message, 500);
        } finally {
            if (connection) await connection.release();
        }
    }

    async getProductInCart(productId, userId){
        const [rows] = await pool.execute(
            `SELECT p.id, p.nombre, p.precio, cp.cantidad, cp.total FROM ${this.#tables.carritos} c
            JOIN ${this.#tables.carritos_x_productos} cp
            ON c.id = cp.carrito_id
            JOIN productos p
            ON cp.producto_id = p.id
            JOIN ${this.#tables.carritos_x_usuarios} cu
            ON c.id = cu.carrito_id
            WHERE cu.usuario_id = ? AND p.id = ?;`,[userId, productId]
        );

        return rows[0];
    }

    async updateProductInCart(producto, cartId, cantidadProducto, subtotalProducto){
        const connection = await pool.getConnection();
        
        try {
            await connection.beginTransaction();
            
            await connection.execute(
                `UPDATE ${this.#tables.carritos_x_productos} SET cantidad = ?, total = ? WHERE producto_id = ? AND carrito_id = ?;`,[cantidadProducto, subtotalProducto, producto.id, cartId]
            );

            var cantidadTotal = await this.getAmountByCart(cartId);
            var subtotalCarrito = await this.getSubtotalByCart(cartId);


            cantidadTotal+=parseInt(producto.cantidad);
            subtotalCarrito+=parseFloat(producto.total);

            await connection.execute(
                `UPDATE ${this.#tables.carritos} SET cantidad_productos = ?, subtotal = ? WHERE id = ?;`,[cantidadTotal, subtotalCarrito, cartId]
            );

            await connection.commit();


        } catch (error) {
            if (connection) await connection.rollback();
            throw new AppError('Internal Server Error', error.message, 500);
        } finally {
            if (connection) await connection.release();
        }
    }

    async updateUserCart(producto, cartId){
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            const [result] = await connection.execute(
                `INSERT INTO ${this.#tables.carritos_x_productos} (carrito_id, producto_id, cantidad, total) 
                VALUES (?,?,?,?);`,[cartId, producto.id, producto.cantidad, producto.total]
            );


            const [c_x_p] = await connection.execute(
                `SELECT * FROM carritos_x_productos cp WHERE cp.carrito_id = ?;`,[9]
            );




            var cantidadTotal = await this.getAmountByCart(cartId);
            cantidadTotal+=parseInt(producto.cantidad);
            var subtotalCarrito = await this.getSubtotalByCart(cartId);
            subtotalCarrito+=parseFloat(producto.total);

            await connection.execute(
                `UPDATE ${this.#tables.carritos} SET cantidad_productos = ?, subtotal = ? WHERE id = ?;`,[cantidadTotal, subtotalCarrito, cartId]
            );

            await connection.commit();
            
        } catch (error) {
            throw new AppError('Internal Server Error', error.message, 500);
        } finally {
            if (connection) await connection.release();
        }


    }

    async getAmountByCart(cartId){
        const [row] = await pool.execute(
            `SELECT SUM(cantidad) cantidad FROM ${this.#tables.carritos_x_productos} WHERE carrito_id = ?;`,[cartId]
        );
        return parseInt(row[0].cantidad);
    }

    async getSubtotalByCart(cartId){
        const [row] = await pool.execute(
            `SELECT SUM(subtotal) subtotal FROM ${this.#tables.carritos} WHERE id = ?;`,[cartId]
        );

        return parseFloat(row[0].subtotal);
    }

}
