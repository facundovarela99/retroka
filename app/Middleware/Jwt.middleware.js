import jwt from 'jsonwebtoken';

const secret = process.env.JWT_SECRET;

export const generateToken = async (user) => {
    const token = await jwt.sign({
        id: user.id,
        email: user.email,
        is_logged: true
    }, secret, {
        expiresIn: '120m', algorithm:'HS256'
    });

    return token;
}