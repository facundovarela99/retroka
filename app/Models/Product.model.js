import { pool } from "../Config/Database.js";
import { AppError } from "./Error.model.js";

export class ProductModel{

    #table = 'productos';
    #variantsTable = 'productos_variantes';
    #sizesTable = 'talles';
    #variantFilesTable = 'archivos_variantes';

    async getAll(){
        const [rows] = await pool.execute(
            `SELECT
                p.id,
                p.nombre,
                p.descripcion,
                p.categoria,
                c.nombre AS categoria_producto,
                COALESCE(SUM(CASE WHEN pv.activo = 1 THEN pv.stock ELSE 0 END), 0) AS stock,
                COUNT(CASE WHEN pv.activo = 1 THEN pv.id END) AS cantidad_variantes,
                MIN(CASE WHEN pv.activo = 1 THEN pv.precio END) AS precio_desde
            FROM ${this.#table} p
            LEFT JOIN ${this.#variantsTable} pv ON pv.producto_id = p.id
            LEFT JOIN categorias c ON p.categoria = c.id
            WHERE p.activo = 1
            GROUP BY p.id, p.nombre, p.descripcion, p.categoria, c.nombre
            ORDER BY p.id DESC;`
        );

        return rows;
    }

    async getStockForAll() {
        const [rows] = await pool.execute(
            `SELECT pv.producto_id, SUM(pv.stock) AS stock_total
            FROM ${this.#variantsTable} pv
            WHERE pv.activo = 1
            GROUP BY pv.producto_id;`
        );
        return rows;
    }

    async getAllForStore(){
        const products = await this.getAll();
        return products.filter((product) => Number(product.cantidad_variantes) > 0);
    }

    async findStorefrontVariants(productIds){
        if (!Array.isArray(productIds) || productIds.length === 0) {
            return [];
        }

        const ids = [...new Set(productIds.map(Number))];

        if (ids.some((id) => !Number.isInteger(id) || id < 1)) {
            throw new AppError('Bad Request', 'Ids de productos invalidos', 400);
        }

        const placeholders = ids.map(() => '?').join(', ');
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
                pv.color,
                pv.stock,
                pv.precio,
                (SELECT av.url
                    FROM ${this.#variantFilesTable} av
                    WHERE av.producto_id = p.id AND av.variante_id = pv.id
                    ORDER BY av.id
                    LIMIT 1) AS imagen_archivo
            FROM ${this.#variantsTable} pv
            INNER JOIN ${this.#table} p ON p.id = pv.producto_id
            INNER JOIN ${this.#sizesTable} t ON t.id = pv.talle_id
            LEFT JOIN categorias c ON p.categoria = c.id
            WHERE p.activo = 1
                AND pv.activo = 1
                AND p.id IN (${placeholders})
            ORDER BY p.id, pv.id;`,
            ids
        );

        return rows;
    }
    async getAllDeleted(){
        const [rows] = await pool.execute(
            `SELECT
                p.id,
                p.nombre,
                p.descripcion,
                p.categoria,
                c.nombre AS categoria_producto,
                COALESCE(SUM(pv.stock), 0) AS stock,
                COUNT(pv.id) AS cantidad_variantes
            FROM ${this.#table} p
            LEFT JOIN ${this.#variantsTable} pv ON pv.producto_id = p.id
            LEFT JOIN categorias c ON p.categoria = c.id
            WHERE p.activo = 0
            GROUP BY p.id, p.nombre, p.descripcion, p.categoria, c.nombre
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
                p.categoria,
                p.activo,
                c.nombre AS categoria_producto,
                COALESCE(SUM(CASE WHEN pv.activo = 1 THEN pv.stock ELSE 0 END), 0) AS stock,
                COUNT(CASE WHEN pv.activo = 1 THEN pv.id END) AS cantidad_variantes,
                MIN(CASE WHEN pv.activo = 1 THEN pv.precio END) AS precio_desde
            FROM ${this.#table} p
            LEFT JOIN ${this.#variantsTable} pv ON pv.producto_id = p.id
            LEFT JOIN categorias c
            ON p.categoria = c.id
            WHERE p.id = ?
            GROUP BY p.id, p.nombre, p.descripcion, p.categoria, p.activo, c.nombre;`,[id]
        );

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
                pv.color,
                pv.stock,
                pv.precio,
                pv.activo,
                (SELECT av.url
                    FROM ${this.#variantFilesTable} av
                    WHERE av.producto_id = p.id AND av.variante_id = pv.id
                    ORDER BY av.id
                    LIMIT 1) AS imagen_archivo
            FROM ${this.#variantsTable} pv
            INNER JOIN ${this.#table} p ON p.id = pv.producto_id
            INNER JOIN ${this.#sizesTable} t ON t.id = pv.talle_id
            LEFT JOIN categorias c ON p.categoria = c.id
            WHERE pv.producto_id = ?
                AND p.activo = 1
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
                pv.color,
                pv.stock,
                pv.precio,
                pv.activo,
                (SELECT av.url
                    FROM ${this.#variantFilesTable} av
                    WHERE av.producto_id = p.id AND av.variante_id = pv.id
                    ORDER BY av.id
                    LIMIT 1) AS imagen_archivo
            FROM ${this.#variantsTable} pv
            INNER JOIN ${this.#table} p ON p.id = pv.producto_id
            INNER JOIN ${this.#sizesTable} t ON t.id = pv.talle_id
            LEFT JOIN categorias c ON p.categoria = c.id
            WHERE pv.producto_id = ?
                AND pv.id = ?
                AND p.activo = 1
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
        let {nombre, descripcion, categoria} = body;

        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();

            if (categoria === undefined) categoria = null;
            

            const [rows] = await connection.execute(
                `INSERT INTO ${this.#table} (nombre, descripcion, categoria)
                values (?,?,?);`,[nombre, descripcion, categoria]
            );

            await connection.commit();

            return {
                id: rows.insertId,
                nombre,
                descripcion,
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

    async publish(id, categoria){
        const connection = await pool.getConnection();
        console.log('Publicando producto con id:', id, 'y categoria:', categoria);

        try {
            await connection.beginTransaction();

            const [productResult] = await connection.execute(
                `UPDATE ${this.#table} SET activo = 1, categoria = ? WHERE id = ?;`,[categoria, id]
            );

            const [variantResult] = await connection.execute(
                `UPDATE ${this.#variantsTable} SET activo = 1 WHERE producto_id = ?;`,[id]
            );

            console.log('Resultado de la actualización del producto:', productResult);
            console.log('Resultado de la actualización de las variantes:', variantResult);

            await connection.commit();

        } catch (error) {
            if (connection) await connection.rollback();
            throw new AppError('Internal Server Error', error.message, 500);
        } finally{
            if (connection) connection.release();
        }
    }

    async update(id, body){
        let connection;
        const fields = [];
        const values = [];

        for (const key of ['nombre', 'descripcion', 'categoria']) {
            if (body[key] !== undefined) {
                fields.push(`${key} = ?`);
                values.push(body[key]);
            }
        }

        if (fields.length === 0) {
            return { affectedRows: 0 };
        }

        const query = `UPDATE ${this.#table} SET ${fields.join(", ")} WHERE id = (?)`;
        values.push(id);
        try {
            connection = await pool.getConnection();

            await connection.beginTransaction();
            
            const [result] = await connection.execute(query, values);
            
            await connection.commit();

            return result;
            
        } catch (error) {
            if (connection) await connection.rollback();
            throw new AppError('Internal Server Error', error.message, 500);
        }finally{
            if (connection) connection.release();
        }
    }

    async delete(id){
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            await connection.execute(
                `UPDATE ${this.#table}
                SET activo = 0, categoria = NULL
                WHERE id = ? AND activo = 1;`,
                [id]
            );

            await connection.execute(
                `UPDATE ${this.#variantsTable} SET activo = 0 WHERE producto_id = ?;`,[id]
            );

            await connection.commit();
        } catch (error) {
            if (connection) await connection.rollback();
            throw error instanceof AppError
                ? error
                : new AppError('Internal Server Error', error.message, 500);
        } finally {
            connection.release();
        }
    }

    async getTalles(){
        const [rows] = await pool.execute(
            `SELECT id, tipo FROM ${this.#sizesTable} ORDER BY id;`
        );
        return rows
    }

    async findSizeByID(id){
        const [rows] = await pool.execute(
            `SELECT id, tipo FROM ${this.#sizesTable} WHERE id = ? LIMIT 1;`,
            [id]
        );

        return rows[0];
    }

}
