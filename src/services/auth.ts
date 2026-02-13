import passport, { Passport } from 'passport';
import { Usuario } from '@prisma/client';
import { Strategy as JWTStrategy, ExtractJwt } from 'passport-jwt';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { FastifyReply, FastifyRequest } from "fastify";
import { userModel } from '@/model/user';
import 'fastify'
import '@fastify/secure-session';


declare module '@fastify/secure-session' {
    interface SessionData {
        token?: string;
    }
}
declare module 'fastify' {
    interface Data { }
    interface FastifyRequest {
        data?: Data;
    }
}
class AuthService {
    constructor() {
        this.configurePassport();
    }
    private ExtractJwtFromSession = (req: FastifyRequest) => {
        const session = req.session.token;
        if (session) {
            return session;
        }
        return null;
    }
    private configurePassport() {
        passport.use(new JWTStrategy(
            {
                jwtFromRequest: this.ExtractJwtFromSession,
                secretOrKey: process.env.JWT_SECRET as string,
            },
            async (payload: { nome: string }, done) => {
                try {
                    const admin = await userModel.getByName(payload.nome);
                    if (!admin) {
                        return done(null, false, { message: "Admin não encontrado" });
                    }
                    return done(null, admin);
                } catch (error) {
                    done(error, false);
                }
            }
        ));
    }

    async generateToken(admin: Partial<Usuario>): Promise<string> {
        const payload = admin;
        return jwt.sign(payload, process.env.JWT_SECRET as string, {
            expiresIn: process.env.JWT_EXPIRES_IN,
        });
    }
    async verifyUser(req: FastifyRequest) {
        const User = req.data as Usuario
        return User
    }

    public async login(req: FastifyRequest, admin: Partial<Usuario>): Promise<void> {
        const token = await this.generateToken(admin);
        req.session.token = token
    }
    public async authenticate(req: FastifyRequest, reply: FastifyReply) {
        try {
            const token = req.session.token
            if (!token) {
                return reply.code(401).send({ message: "Token não fornecido" });
            }
            const admin = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
            if (!admin) {
                return reply.code(408).send({ message: "Token inválido ou expirado" });
            }
            return req.data = admin
        } catch (err) {
            return reply.status(400).send({ message: "Token inválido ou expirado" + err });
        }
    }
    public async logout(req: FastifyRequest, res: FastifyReply) {
        req.session.delete();
        res.send({ message: "Logout realizado com sucesso" });
    }
}
export const authService = new AuthService()