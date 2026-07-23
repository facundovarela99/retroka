import { pool } from "../Config/Database.js";
import { AppError } from "./Error.model.js";


export class CartModel{
 
    #tables = {carritos:'carritos', carritos_x_productos:'carritos_x_productos', carritos_x_usuarios:'carritos_x_usuarios'};

    async createUserCart(userId, carrito){
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            const [result] =  await connection.execute(
                `INSERT INTO ${this.#tables.carritos} (cantidad_productos, subtotal) VALUES (?,?);`,[carrito.cantidad, carrito.subtotal]
            );

            const lastInsertId = result.insertId; 


            carrito.productos.forEach( async (producto)=>{
                await connection.execute(
                    `INSERT INTO ${this.#tables.carritos_x_productos} VALUES (?,?,?,?);`,[lastInsertId, producto.id, producto.cantidad, producto.total]
                );
            });

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

    // async getUserCart(id) {
    //     const [rows] = await pool.execute(
    //         `SELECT * FROM `
    //     )
    // }
}