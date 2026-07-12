import { pool } from "../Config/Database.js";
import { AppError } from "./Error.model.js";

export class CategoryModel {
    #table = 'categorias';

    async getAll(){
        const [rows] = await pool.execute(
            `SELECT * FROM ${this.#table};`
        );

        if (rows.length === 0) throw new AppError('Not Found', 'No existen categorias', 404);
        return rows;
    }

    async findByID(id){
        const [row] = await pool.execute(
            `SELECT * FROM ${this.#table} WHERE id = ?;`,[id]
        );
        
        if (row.length === 0) return undefined;
        return row[0]
    }

    async findByName(name){
        const [row] = await pool.execute(
            `SELECT * FROM ${this.#table} WHERE nombre = ?;`,[name]
        );

        if (row.length === 0) return undefined;

        return row[0]
    }

    async create(body) {
        const {nombre} = body;

        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            const [rows] = await connection.execute(
                `INSERT INTO ${this.#table} (nombre) VALUES (?);`, [nombre]
            );

            await connection.commit();

            return {
                id: rows.insertId,
                nombre,
            };

        } catch (error) {
            if (connection) await connection.rollback();
            throw new AppError('Internal Server Error', error.message, 500);
        } finally {
            if (connection) await connection.release();
        }
    }

    async update(id, name){
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            await connection.execute(
                `UPDATE ${this.#table} SET nombre = ? WHERE id = ?;`,[name, id]
            );

            await connection.commit();
            
        } catch (error) {
            if (connection) await connection.rollback();
            throw new AppError('Internal Server error', 'Error al actualizar la categoría: '+error.message,500);
        } finally {
            if (connection) await connection.release();
        }
    }

    async delete(id){
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            await connection.execute(
                `DELETE FROM ${this.#table} WHERE id = ?;`,[id]
            );

            await connection.commit();
        } catch (error) {
            if (connection) await connection.rollback();
            throw new AppError('Internal Server error', 'Error al eliminar la categoría: '+error.message, 500);
        } finally {
            if (connection) await connection.release();
        }
    }

}