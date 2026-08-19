import { pool } from "../Config/Database.js";
import { AppError } from "./Error.model.js";


export class CartModel{
 
    #tables = {carritos:'carritos', carritos_x_productos:'carritos_x_productos', carritos_x_usuarios:'carritos_x_usuarios'};

    async #updateCartTotals(connection, cartId){
        const [totals] = await connection.execute(
            `SELECT COALESCE(SUM(cantidad), 0) cantidad, COALESCE(SUM(total), 0) subtotal 
            FROM ${this.#tables.carritos_x_productos} 
            WHERE carrito_id = ?;`,[cartId]
        );

        const cantidadTotal = parseInt(totals[0].cantidad);
        const subtotalCarrito = parseFloat(totals[0].subtotal);

        await connection.execute(
            `UPDATE ${this.#tables.carritos} SET cantidad_productos = ?, subtotal = ? WHERE id = ?;`,[cantidadTotal, subtotalCarrito, cartId]
        );

        return {
            cantidad: cantidadTotal,
            subtotal: subtotalCarrito
        };
    }

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
            `SELECT p.id, 
            p.nombre, 
            p.precio, 
            p.stock, 
            cp.cantidad, 
            cp.total 
            FROM ${this.#tables.carritos} c
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
            `SELECT p.id, p.nombre, p.precio, p.stock, p.imagen, p.url, cp.cantidad, cp.total FROM ${this.#tables.carritos} c
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

            await this.#updateCartTotals(connection, cartId);

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


            await this.#updateCartTotals(connection, cartId);

            await connection.commit();
            
        } catch (error) {
            if (connection) await connection.rollback();
            throw new AppError('Internal Server Error', error.message, 500);
        } finally {
            if (connection) await connection.release();
        }
    }

    async subtractProduct(productId, userId){
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            const cartId = await this.getUserCartId(userId);

            const product = await this.getProductInCart(productId, userId);

            if (!product) throw new AppError('Not Found', 'Producto inexistente en el carrito', 404);

            if (product.cantidad <= 1) {
                throw new AppError('Bad Request', 'No se puede restar una unidad de un producto con cantidad 1', 400);
            }

            await connection.execute(
                `UPDATE ${this.#tables.carritos_x_productos} SET cantidad = ?, total = ? WHERE carrito_id = ? AND producto_id = ?;`,[product.cantidad-1, product.total-product.precio, cartId, productId]
            );

            await this.#updateCartTotals(connection, cartId);

            await connection.commit();


        } catch (error) {
            if (connection) await connection.rollback();
            throw error instanceof AppError
                ? error
                : new AppError('Internal Server Error', error.message, 500);
        } finally {
            if (connection) await connection.release();
        }
    }

    async removeProduct(productId, userId){
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            const cartId = await this.getUserCartId(userId);

            const [result] = await connection.execute(
                `DELETE FROM ${this.#tables.carritos_x_productos} WHERE carrito_id = ? AND producto_id = ?;`,[cartId, productId]
            );

            if (result.affectedRows === 0) {
                throw new AppError('Not Found', 'Producto inexistente en el carrito', 404);
            }

            await this.#updateCartTotals(connection, cartId);

            await connection.commit();
            
        } catch (error) {
            if (connection) await connection.rollback();
            throw error instanceof AppError
                ? error
                : new AppError('Internal Server Error', error.message, 500);
        } finally {
            if (connection) await connection.release();
        }
    }

    async deleteUserCart(userId){
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const cartId = await this.getUserCartId(userId);

            await connection.execute(
                `DELETE FROM ${this.#tables.carritos_x_usuarios} WHERE usuario_id = ?;`,[userId]
            );

            await connection.execute(
                `DELETE FROM ${this.#tables.carritos_x_productos} WHERE carrito_id = ?;`,[cartId]
            );

            await connection.execute(
                `DELETE FROM ${this.#tables.carritos} WHERE id = ?;`,[cartId]
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
            `SELECT SUM(total) subtotal FROM ${this.#tables.carritos_x_productos} WHERE carrito_id = ?;`,[cartId]
        );

        return parseFloat(row[0].subtotal);
    }

}
