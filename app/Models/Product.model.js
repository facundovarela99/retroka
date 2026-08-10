import { pool } from "../Config/Database.js";
import { AppError } from "./Error.model.js";

export class ProductModel{

    #table = 'productos'

    async getAll(){
        const [rows] = await pool.execute(
            `SELECT p.*, c.nombre AS categoria_producto
            FROM ${this.#table} p
            LEFT JOIN categorias c ON p.categoria = c.id;`
        );

        return rows;
    }

    async findByID(id){
        const [row] = await pool.execute(
            `SELECT p.*, c.nombre AS categoria_producto FROM ${this.#table} p
            LEFT JOIN categorias c
            ON p.categoria = c.id
            WHERE p.id = ?;`,[id]
        );

        if (row.length === 0) throw new AppError('Not Found', 'Producto inexistente', 404);

        return row[0];
    }

    // Hasta contar con un identificador de modelo/variante en la tabla,
    // categoría + descripción (o nombre) funciona como agrupador estable.
    async findVariants(producto){
        const descripcion = typeof producto.descripcion === 'string'
            ? producto.descripcion.trim()
            : '';
        const identityColumn = descripcion ? 'descripcion' : 'nombre';
        const identityValue = descripcion || producto.nombre;

        const [rows] = await pool.execute(
            `SELECT p.*, c.nombre AS categoria_producto
            FROM ${this.#table} p
            LEFT JOIN categorias c ON p.categoria = c.id
            WHERE p.categoria <=> ?
                AND LOWER(TRIM(p.${identityColumn})) = LOWER(TRIM(?))
            ORDER BY FIELD(p.talle, 'S', 'M', 'L', 'XL'), p.id;`,
            [producto.categoria ?? null, identityValue]
        );

        return rows;
    }

    async create(body){
        let connection;
        let {nombre, descripcion, talle, stock, precio, categoria, url, imagen} = body;

        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();

            if (categoria === undefined) categoria = null;
            

            const [rows] = await connection.execute(
                `INSERT INTO ${this.#table} (nombre, descripcion, talle, stock, precio, categoria, url, imagen) 
                values (?,?,?,?,?,?,?,?);`,[nombre, descripcion, talle, stock, precio, categoria, url, imagen]
            );

            await connection.commit();

            return {
                id: rows.insertId,
                nombre,
                descripcion
            };

        } catch (error) {
            if (connection) await connection.rollback();
            throw new AppError('Internal Server Error', error.message, 500);
        }finally{
            if (connection) await connection.release();
        }
    }

    async update(id, body){
        let connection;
        const fields = [];
        const values = [];

        for (const key of ['nombre', 'descripcion', 'talle', 'stock', 'precio', 'categoria', 'url', 'imagen']) {
            if (body[key] !== undefined) {
                fields.push(`${key} = ?`);
                values.push(body[key]);
            }
        }

        if (fields.length === 0) {
            throw new AppError('No Content', 'No hay campos para actualizar', 204);
        }

        const query = `UPDATE ${this.#table} SET ${fields.join(", ")} WHERE id = (?)`;
        values.push(id);
        try {
            connection = await pool.getConnection();

            await connection.beginTransaction();
            
            const [result] = await connection.query(query, values);
            
            await connection.commit();
            
        } catch (error) {
            if (connection) await connection.rollback();
            throw new AppError('Internal Server Error', error.message, 500);
        }finally{
            if (connection) await connection.release();
        }
    }

    async delete(id){
        try {

            await pool.execute(
                `DELETE FROM ${this.#table} WHERE id = ?;`,[id]
            );

        } catch (error) {
            throw new AppError('Internal Server Error', 'Error interno del servidor', 500);
        }
    }

}
