import { pool } from "../Config/Database.js";
import { AppError } from "./Error.model.js";

export class UserModel{

    async create(data){
        let connection;

        try {
            connection = await pool.getConnection();

            await connection.beginTransaction();
            const {email, nombre, password, telefono, codigo_postal, localidad, provincia, is_admin} = data;

            const mysqlDate = new Date().toISOString().slice(0, 19).replace('T', ' ')

            console.log('Is admin: ', is_admin);

            const [result] = await connection.execute(
                `INSERT INTO usuarios (email, nombre, password, telefono, codigo_postal, localidad, provincia, created_at, is_admin) 
                values (?,?,?,?,?,?,?,?,?)`,[email, nombre, password, telefono, codigo_postal, localidad, provincia, mysqlDate, is_admin]
            );
            await connection.commit();

            return {
                id: result.insertId,
                email,
                nombre,
                is_admin
            };
        } catch (error) {
            if (connection) await connection.rollback();
            throw new AppError('Internal Server Error', error.message, 500);
        } finally {
            if (connection) await connection.release();
        }
    }

    async findByColumns(columns, fieldToCompare, data){

        const fields = columns.join(', ');

        const [row] = await pool.execute(
            `SELECT ${fields} FROM usuarios WHERE ${fieldToCompare} = ?`,[data]
        );

        if (row.length === 0){
            return undefined;
        }
        return row[0];
    }


    async findByID(id) {
        const [rows] = await pool.execute(
            "SELECT * FROM usuarios WHERE id = ?",[id]
        );

        return rows[0];
    }
}
