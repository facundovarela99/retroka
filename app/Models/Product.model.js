import { pool } from "../Config/Database.js";
import { AppError } from "./Error.model.js";

export class ProductModel{

    #table = 'productos';
    #variantsTable = 'productos_variantes';
    #sizesTable = 'talles';
    #filesTable = 'archivos';

    async getAll(){
        const [rows] = await pool.execute(
            `SELECT
                p.id,
                p.nombre,
                p.descripcion,
                p.stock,
                p.precio,
                p.categoria,
                c.nombre AS categoria_producto,
                (SELECT a.url
                    FROM ${this.#filesTable} a
                    WHERE a.producto_id = p.id
                    ORDER BY a.id
                    LIMIT 1) AS imagen_archivo
            FROM ${this.#table} p
            LEFT JOIN categorias c ON p.categoria = c.id
            ORDER BY p.id DESC;`
        );

        return rows;
    }

    async findByID(id){
        const [row] = await pool.execute(
            `SELECT
                p.id,
                p.nombre,
                p.descripcion,
                p.stock,
                p.precio,
                p.categoria,
                c.nombre AS categoria_producto,
                (SELECT a.url
                    FROM ${this.#filesTable} a
                    WHERE a.producto_id = p.id
                    ORDER BY a.id
                    LIMIT 1) AS imagen_archivo
            FROM ${this.#table} p
            LEFT JOIN categorias c
            ON p.categoria = c.id
            WHERE p.id = ?;`,[id]
        );

        if (row.length === 0) throw new AppError('Not Found', 'Producto inexistente', 404);

        return row[0];
    }

    async findVariants(producto){
        const productId = typeof producto === 'object' ? producto?.id : producto;

        if (!Number.isInteger(Number(productId)) || Number(productId) < 1) {
            throw new AppError('Bad Request', 'Id de producto invalido', 400);
        }

        const [rows] = await pool.execute(
            `SELECT
                p.id,
                p.nombre,
                p.descripcion,
                p.categoria,
                c.nombre AS categoria_producto,
                pv.id AS variante_id,
                pv.talle_id,
                t.tipo AS talle,
                pv.stock,
                COALESCE(pv.precio, p.precio) AS precio,
                pv.activo,
                (SELECT a.url
                    FROM ${this.#filesTable} a
                    WHERE a.producto_id = p.id
                    ORDER BY a.id
                    LIMIT 1) AS imagen_archivo
            FROM ${this.#variantsTable} pv
            INNER JOIN ${this.#table} p ON p.id = pv.producto_id
            INNER JOIN ${this.#sizesTable} t ON t.id = pv.talle_id
            LEFT JOIN categorias c ON p.categoria = c.id
            WHERE pv.producto_id = ?
                AND pv.activo = 1
            ORDER BY t.id, pv.id;`,
            [productId]
        );

        return rows;
    }

    async findVariantByID(productId, variantId){
        const [rows] = await pool.execute(
            `SELECT
                p.id,
                p.nombre,
                p.descripcion,
                p.categoria,
                c.nombre AS categoria_producto,
                pv.id AS variante_id,
                pv.talle_id,
                t.tipo AS talle,
                pv.stock,
                COALESCE(pv.precio, p.precio) AS precio,
                pv.activo,
                (SELECT a.url
                    FROM ${this.#filesTable} a
                    WHERE a.producto_id = p.id
                    ORDER BY a.id
                    LIMIT 1) AS imagen_archivo
            FROM ${this.#variantsTable} pv
            INNER JOIN ${this.#table} p ON p.id = pv.producto_id
            INNER JOIN ${this.#sizesTable} t ON t.id = pv.talle_id
            LEFT JOIN categorias c ON p.categoria = c.id
            WHERE pv.producto_id = ?
                AND pv.id = ?
                AND pv.activo = 1
            LIMIT 1;`,
            [productId, variantId]
        );

        if (rows.length === 0) {
            throw new AppError('Not Found', 'Variante de producto inexistente', 404);
        }

        return rows[0];
    }

    async create(body){
        let connection;
        let {nombre, descripcion, talle, stock, precio, categoria} = body;

        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();

            if (categoria === undefined) categoria = null;
            

            const [rows] = await connection.execute(
                `INSERT INTO ${this.#table} (nombre, descripcion, stock, precio, categoria)
                values (?,?,?,?,?);`,[nombre, descripcion, stock, precio, categoria]
            );

            const [variantResult] = await connection.execute(
                `INSERT INTO ${this.#variantsTable} (producto_id, talle_id, stock, precio, activo)
                VALUES (?,?,?,?,?);`,[rows.insertId, talle, stock, precio, 1]
            );

            await connection.commit();

            return {
                id: rows.insertId,
                variante_id: variantResult.insertId,
                talle_id: talle,
                nombre,
                descripcion,
                stock,
                precio,
                categoria
            };

        } catch (error) {
            if (connection) await connection.rollback();

            throw error instanceof AppError
                ? error
                : new AppError('Internal Server Error', error.message, 500);
        }finally{
            if (connection) connection.release();
        }
    }

    async update(id, body){
        let connection;
        const fields = [];
        const values = [];

        for (const key of ['nombre', 'descripcion', 'stock', 'precio', 'categoria']) {
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
            
            await connection.execute(query, values);
            
            await connection.commit();
            
        } catch (error) {
            if (connection) await connection.rollback();
            throw new AppError('Internal Server Error', error.message, 500);
        }finally{
            if (connection) connection.release();
        }
    }

    async updateVariant(productId, variantId, body){
        const fields = [];
        const values = [];
        const variantData = {
            talle_id: body.talle_id ?? body.talle,
            stock: body.stock,
            precio: body.precio,
            activo: body.activo
        };

        for (const [field, value] of Object.entries(variantData)) {
            if (value !== undefined) {
                fields.push(`${field} = ?`);
                values.push(value);
            }
        }

        if (fields.length === 0) {
            throw new AppError('No Content', 'No hay campos de variante para actualizar', 204);
        }

        let connection;

        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();

            values.push(variantId, productId);
            const [result] = await connection.execute(
                `UPDATE ${this.#variantsTable}
                SET ${fields.join(', ')}
                WHERE id = ? AND producto_id = ?;`,
                values
            );

            if (result.affectedRows === 0) {
                throw new AppError('Not Found', 'Variante de producto inexistente', 404);
            }

            await connection.commit();
        } catch (error) {
            if (connection) await connection.rollback();

            throw error instanceof AppError
                ? error
                : new AppError('Internal Server Error', error.message, 500);
        } finally {
            if (connection) connection.release();
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

    async getTalles(){
        const [rows] = await pool.execute(
            `SELECT id, tipo FROM ${this.#sizesTable} ORDER BY id;`
        );
        return rows
    }

}
