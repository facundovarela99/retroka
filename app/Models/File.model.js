import { pool } from "../Config/Database.js";
import { AppError } from "./Error.model.js";


export class FileModel{
    #table = 'archivos'

    async createMany(productId, files){
        if (!Array.isArray(files) || files.length === 0) {
            return [];
        }

        let connection;

        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();

            const insertedFiles = [];

            for (const file of files) {
                const [result] = await connection.execute(
                    `INSERT INTO ${this.#table}
                        (producto_id, url, nombre, nombre_original, mime_type, size)
                    VALUES (?, ?, ?, ?, ?, ?);`,
                    [
                        productId,
                        file.url,
                        file.nombre,
                        file.nombre_original,
                        file.mime_type,
                        file.size
                    ]
                );

                insertedFiles.push({
                    id: result.insertId,
                    producto_id: productId,
                    ...file
                });
            }

            await connection.commit();
            return insertedFiles;
        } catch (error) {
            if (connection) await connection.rollback();

            throw new AppError(
                'Internal Server Error',
                `No se pudieron registrar las imagenes: ${error.message}`,
                500
            );
        } finally {
            if (connection) connection.release();
        }
    }

    async findByProductId(productId){
        const [rows] = await pool.execute(
            `SELECT id, producto_id, url, nombre, nombre_original, mime_type, size, created_at
            FROM ${this.#table}
            WHERE producto_id = ?
            ORDER BY id;`,
            [productId]
        );

        return rows;
    }
}
