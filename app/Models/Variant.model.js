import { pool } from '../Config/Database.js';
import { AppError } from './Error.model.js';

export class VariantModel {
    #table = 'productos_variantes';
    #sizesTable = 'talles';

    async findByProductId(productId){
        try {
            const [rows] = await pool.execute(
                `SELECT
                    pv.id AS variante_id,
                    pv.producto_id,
                    pv.talle_id,
                    t.tipo AS talle,
                    pv.color,
                    pv.stock,
                    pv.precio,
                    pv.activo
                FROM ${this.#table} pv
                INNER JOIN ${this.#sizesTable} t ON t.id = pv.talle_id
                WHERE pv.producto_id = ? AND pv.activo = 1
                ORDER BY t.id, pv.id;`,
                [productId]
            );

            return rows;
        } catch (error) {
            throw new AppError('Internal Server Error', error.message, 500);
        }
    }

    async findByID(productId, variantId){
        try {
            const [rows] = await pool.execute(
                `SELECT
                    pv.id AS variante_id,
                    pv.producto_id,
                    pv.talle_id,
                    t.tipo AS talle,
                    pv.color,
                    pv.stock,
                    pv.precio,
                    pv.activo
                FROM ${this.#table} pv
                INNER JOIN ${this.#sizesTable} t ON t.id = pv.talle_id
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
        } catch (error) {
            throw error instanceof AppError
                ? error
                : new AppError('Internal Server Error', error.message, 500);
        }
    }

    async getSizes(){
        try {
            const [rows] = await pool.execute(
                `SELECT id, tipo FROM ${this.#sizesTable} ORDER BY id;`
            );

            return rows;
        } catch (error) {
            throw new AppError('Internal Server Error', error.message, 500);
        }
    }

    async findSizeByID(sizeId){
        try {
            const [rows] = await pool.execute(
                `SELECT id, tipo FROM ${this.#sizesTable} WHERE id = ? LIMIT 1;`,
                [sizeId]
            );

            return rows[0];
        } catch (error) {
            throw new AppError('Internal Server Error', error.message, 500);
        }
    }

    async create(productId, body){
        let connection;

        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();

            await connection.execute(
                `SELECT id
                FROM ${this.#table}
                WHERE producto_id = ?
                FOR UPDATE;`,
                [productId]
            );

            const [existingRows] = await connection.execute(
                `SELECT id, activo
                FROM ${this.#table}
                WHERE producto_id = ?
                    AND talle_id = ?
                    AND TRIM(COALESCE(color, '')) = ?
                ORDER BY activo DESC, id
                LIMIT 1;`,
                [productId, body.talle, body.color]
            );
            const existingVariant = existingRows[0];

            if (existingVariant?.activo) {
                throw new AppError(
                    'Conflict',
                    'El producto ya posee una variante activa para ese talle y color',
                    409
                );
            }

            if (existingVariant) {
                await connection.execute(
                    `UPDATE ${this.#table}
                    SET stock = ?, precio = ?, color = ?, activo = 1
                    WHERE id = ? AND producto_id = ?;`,
                    [body.stock, body.precio, body.color, existingVariant.id, productId]
                );

                await connection.commit();

                return {
                    id:existingVariant.id,
                    producto_id:productId,
                    talle_id:body.talle,
                    color:body.color,
                    stock:body.stock,
                    precio:body.precio,
                    activo:1,
                    reactivada:true
                };
            }

            const [result] = await connection.execute(
                `INSERT INTO ${this.#table}
                    (producto_id, talle_id, color, stock, precio, activo)
                VALUES (?, ?, ?, ?, ?, 1);`,
                [productId, body.talle, body.color, body.stock, body.precio]
            );

            await connection.commit();

            return {
                id:result.insertId,
                producto_id:productId,
                talle_id:body.talle,
                color:body.color,
                stock:body.stock,
                precio:body.precio,
                activo:1,
                reactivada:false
            };
        } catch (error) {
            if (connection) await connection.rollback();

            throw error instanceof AppError
                ? error
                : new AppError('Internal Server Error', error.message, 500);
        } finally {
            if (connection) connection.release();
        }
    }

    async update(productId, variantId, body){
        let connection;

        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();

            await connection.execute(
                `SELECT id
                FROM ${this.#table}
                WHERE producto_id = ?
                FOR UPDATE;`,
                [productId]
            );

            const [rows] = await connection.execute(
                `SELECT id, talle_id, color, stock, precio
                FROM ${this.#table}
                WHERE id = ? AND producto_id = ? AND activo = 1
                LIMIT 1;`,
                [variantId, productId]
            );
            const currentVariant = rows[0];

            if (!currentVariant) {
                throw new AppError('Not Found', 'Variante de producto inexistente', 404);
            }

            const nextSize = body.talle ?? currentVariant.talle_id;
            const nextColor = body.color ?? currentVariant.color ?? '';
            const identityChanged = nextSize !== currentVariant.talle_id
                || nextColor.toLocaleLowerCase() !== String(currentVariant.color || '').toLocaleLowerCase();

            if (identityChanged) {
                const [duplicates] = await connection.execute(
                    `SELECT id
                    FROM ${this.#table}
                    WHERE producto_id = ?
                        AND talle_id = ?
                        AND TRIM(COALESCE(color, '')) = ?
                        AND activo = 1
                        AND id <> ?
                    LIMIT 1;`,
                    [productId, nextSize, nextColor, variantId]
                );

                if (duplicates.length > 0) {
                    throw new AppError(
                        'Conflict',
                        'El producto ya posee una variante activa para ese talle y color',
                        409
                    );
                }
            }

            const fields = [];
            const values = [];
            const fieldMap = {
                talle_id:body.talle,
                color:body.color,
                stock:body.stock,
                precio:body.precio
            };

            for (const [field, value] of Object.entries(fieldMap)) {
                if (value !== undefined) {
                    fields.push(`${field} = ?`);
                    values.push(value);
                }
            }

            if (fields.length > 0) {
                values.push(variantId, productId);
                await connection.execute(
                    `UPDATE ${this.#table}
                    SET ${fields.join(', ')}
                    WHERE id = ? AND producto_id = ? AND activo = 1;`,
                    values
                );
            }

            await connection.commit();

            return {
                id:variantId,
                producto_id:productId,
                talle_id:body.talle ?? currentVariant.talle_id,
                color:body.color ?? currentVariant.color,
                stock:body.stock ?? currentVariant.stock,
                precio:body.precio ?? currentVariant.precio,
                activo:1
            };
        } catch (error) {
            if (connection) await connection.rollback();

            throw error instanceof AppError
                ? error
                : new AppError('Internal Server Error', error.message, 500);
        } finally {
            if (connection) connection.release();
        }
    }

    async softDelete(productId, variantId){
        try {
            const [result] = await pool.execute(
                `UPDATE ${this.#table}
                SET activo = 0
                WHERE id = ? AND producto_id = ? AND activo = 1;`,
                [variantId, productId]
            );

            if (result.affectedRows === 0) {
                throw new AppError('Not Found', 'Variante de producto inexistente', 404);
            }

            return result;
        } catch (error) {
            throw error instanceof AppError
                ? error
                : new AppError('Internal Server Error', error.message, 500);
        }
    }

    async hardDelete(productId, variantId){
        try {
            const [result] = await pool.execute(
                `DELETE FROM ${this.#table}
                WHERE id = ? AND producto_id = ? AND activo = 1;`,
                [variantId, productId]
            );

            if (result.affectedRows === 0) {
                throw new AppError('Not Found', 'Variante de producto inexistente', 404);
            }

            return result;
        } catch (error) {
            throw error instanceof AppError
                ? error
                : new AppError('Internal Server Error', error.message, 500);
        }
    }
}
