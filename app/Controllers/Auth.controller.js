import { AppError } from "../Models/Error.model.js";
import { UserModel } from "../Models/User.model.js";
import { comparePwd, encrypt, setAuthenticatedSession, validarNuevoUsuario } from "../Services/Auth.service.js";
import { SESSION_COOKIE_NAME } from "../Middleware/Session.middleware.js";
import {url} from '../Config/Env.js'
import { generateToken } from "../Middleware/Jwt.middleware.js";
import { cartController } from "./Cart.Controller.js";

export class AuthController{
    #userModel
    #cartController

    constructor(){
        this.#userModel = new UserModel();
        this.#cartController = cartController
    }

    async register(req, res){
        try {
            const body = validarNuevoUsuario(req.body);

            const userExist = await this.#userModel.findByColumns(['email'], 'email', body.email);

            if (userExist) return res.status(400).json({
                data: null,
                error: 'Bad Request',
                message:'El correo ya se encuentra en uso',
                status: 400
            })

            body.password = await encrypt(body.password);

            const user = await this.#userModel.create(body);
            await setAuthenticatedSession(req, user);

            return res.status(201).json({
                data: {
                    user: req.session.user
                },
                message: 'Registro exitoso'
            });

        } catch (error) {
            return res.status(error.statusCode || 500).json({
                data: null,
                error: error.error || 'Internal Server Error',
                message:error.message,
                status: error.statusCode || 500
            })
        }
    }

    async showLogin(req, res){
        if (req.session.user){
            return res.redirect('productos');
        }

        res.status(200).render('login', {
            title:'Login',
            url,
        });
    }

    async login(req, res) {
        try {
            const {email, password, carrito} = req.body;

            const user = await this.#userModel.findByColumns(['id', 'email', 'password', 'is_admin'], 'email', email);

            if (!user) return res.status(400).json({
                data: null,
                error:'Bad Request',
                message:'Usuario inexistente',
                status:400
            });

            await comparePwd(password, user.password);
            await setAuthenticatedSession(req, user);

            const token = await generateToken(user);

            res.cookie('access_token', token, {
                httpOnly: true,
                secure: false,
                sameSite: 'lax',
                maxAge: 1000 * 60 * 60
            });


            if (carrito.length > 0){
                if (await this.#userModel.getUserCart(user.id) !== null){
                    await this.#cartController.update(req, res, true)
                } else{
                   await this.#cartController.create(req, res, true);
                }
            }

            return res.status(200).json({
                data: {
                    user: req.session.user
                },
                message:'Login exitoso'
            });

        } catch (error) {
            return res.status(error.statusCode || 500).json({
                data: null,
                error: error.error || 'Internal Server Error',
                message: error.message,
                status: error.statusCode || 500
            });
        }
    }

    async logout(req, res){
        try {
            if (!req.session) {
                return res.status(200).json({
                    data: true,
                    message: 'Logout exitoso'
                });
            }

            await new Promise((resolve, reject) => {
                req.session.destroy((err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });

            res.clearCookie(SESSION_COOKIE_NAME, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/'
            });
            res.clearCookie('access_token')

            return res.redirect('productos');
        } catch (error) {
            return res.status(500).json({
                data: null,
                error: 'Internal Server Error',
                message: error.message,
                status: 500
            });
        }
    }
}

export const authController = new AuthController();
