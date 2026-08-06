import { pool } from "../Config/Database.js";
import { AppError } from "./Error.model.js";

export class UserModel{

    async create(data){
        let connection;

        try {
            connection = await pool.getConnection();

            await connection.beginTransaction();
            const {
                email,
                nombre,
                password,
                telefono = null,
                codigo_postal = null,
                localidad = null,
                provincia = null,
                is_admin = false
            } = data;

            const mysqlDate = new Date().toISOString().slice(0, 19).replace('T', ' ')

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

            if (error.code === 'ER_DUP_ENTRY') {
                throw new AppError('Conflict', 'El correo ya se encuentra en uso', 409);
            }

            throw new AppError('Internal Server Error', 'No se pudo crear el usuario', 500);
        } finally {
            if (connection) await connection.release();
        }
    }

    async findForAuthentication(email) {
        try {
            const [rows] = await pool.execute(
                'SELECT id, email, password, is_admin FROM usuarios WHERE email = ? LIMIT 1',
                [email]
            );

            return rows[0];
        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                throw new AppError('Service Unavailable', 'Servicio temporalmente no disponible', 503);
            }

            throw new AppError('Internal Server Error', 'Error interno del servidor', 500);
        }
    }

    async findByColumns(columns, fieldToCompare, data){

        try {
            const fields = columns.join(', ');
    
            const [row] = await pool.execute(
                `SELECT ${fields} FROM usuarios WHERE ${fieldToCompare} = ?`,[data]
            );
    
            if (row.length === 0){
                return undefined;
            }
            return row[0];
        } catch (error) {
            if (error.code === 'ECONNREFUSED'){
                throw new AppError('Internal Server Error', 'Error al conectarse con el servidor', 503)
            }
            throw new AppError('Internal Server error', 'Error interno del servidor', 500);
        }
    }


    async findByID(id) {
        const [rows] = await pool.execute(
            "SELECT * FROM usuarios WHERE id = ?",[id]
        );

        return rows[0];
    }

    async getUserCart(id){
        const [row] = await pool.execute(
            `SELECT carrito_id FROM carritos_x_usuarios cu WHERE cu.usuario_id = ?;`,[id]
        );
        
        if (row.length === 0) return null

        return row[0].carrito_id;
    }
}
