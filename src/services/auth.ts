import passport from 'passport';
import { Usuario } from '@prisma/client';
import { Strategy as JWTStrategy, ExtractJwt, StrategyOptions } from 'passport-jwt';
import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import { FastifyReply, FastifyRequest } from "fastify";
import { userModel } from '@/model/user';
import '@fastify/secure-session';

// Declarações de módulo para estender os tipos do Fastify
declare module '@fastify/secure-session' {
    interface SessionData {
        token?: string;
    }
}

declare module 'fastify' {
    interface FastifyRequest {
        data?: JwtPayload | Usuario;
        currentUser?: Usuario; // Usar nome diferente para evitar conflito
    }
}

class AuthService {
    constructor() {
        this.configurePassport();
    }

    /**
     * Extrai o token JWT da sessão
     */
    private extractJwtFromSession = (req: FastifyRequest): string | null => {
        try {
            const session = (req as any).session;
            return session?.token || null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Configura a estratégia JWT do Passport
     */
    private configurePassport(): void {
        const opts: StrategyOptions = {
            jwtFromRequest: ExtractJwt.fromExtractors([
                this.extractJwtFromSession,
                ExtractJwt.fromAuthHeaderAsBearerToken()
            ]),
            secretOrKey: process.env.JWT_SECRET as string,
        };

        passport.use(
            'jwt',
            new JWTStrategy(opts, async (payload: any, done: any) => {
                try {
                    const usuarioId = payload.id || payload.sub;
                    
                    if (!usuarioId) {
                        return done(null, false, { message: "ID do usuário não encontrado no token" });
                    }
                    
                    const usuario = await userModel.getById(usuarioId);

                    if (!usuario) {
                        return done(null, false, { message: "Usuário não encontrado" });
                    }

                    return done(null, usuario);
                } catch (error) {
                    console.error('Erro na estratégia JWT:', error);
                    return done(error, false);
                }
            })
        );
    }

    /**
     * Gera um token JWT para o usuário
     */
    async generateToken(usuario: Partial<Usuario>): Promise<string> {
        if (!usuario.id) {
            throw new Error("ID do usuário é obrigatório para gerar token");
        }

        const payload = {
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            tipo: usuario.tipo
        };

        const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
        
        const signOptions: SignOptions = {
            expiresIn: expiresIn as SignOptions['expiresIn'],
            subject: usuario.id
        };

        return jwt.sign(
            payload, 
            process.env.JWT_SECRET as string, 
            signOptions
        );
    }

    /**
     * Realiza o login do usuário
     */
    public async login(req: FastifyRequest, usuario: Partial<Usuario>): Promise<void> {
        try {
            const token = await this.generateToken(usuario);
            const session = (req as any).session;
            if (session) {
                session.token = token;
            }
        } catch (error) {
            console.error('Erro no login:', error);
            throw new Error('Falha ao realizar login');
        }
    }

    /**
     * Autentica o usuário baseado no token
     */
    public async authenticate(req: FastifyRequest, reply: FastifyReply) {
        try {
            const session = (req as any).session;
            const token = session?.token;

            if (!token) {
                return reply.status(401).send({ 
                    success: false,
                    message: "Token não fornecido" 
                });
            }

            const decoded = jwt.verify(
                token, 
                process.env.JWT_SECRET as string
            ) as JwtPayload;

            if (!decoded || !decoded.id) {
                return reply.status(401).send({ 
                    success: false,
                    message: "Token inválido" 
                });
            }

            const usuario = await userModel.getById(decoded.id);

            if (!usuario) {
                return reply.status(401).send({ 
                    success: false,
                    message: "Usuário não encontrado" 
                });
            }

            req.data = decoded;
            req.currentUser = usuario; // Usar currentUser em vez de user

            return {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email,
                tipo: usuario.tipo
            };

        } catch (err) {
            if (err instanceof jwt.TokenExpiredError) {
                return reply.status(401).send({ 
                    success: false,
                    message: "Token expirado" 
                });
            }
            
            if (err instanceof jwt.JsonWebTokenError) {
                return reply.status(401).send({ 
                    success: false,
                    message: "Token inválido" 
                });
            }

            console.error('Erro na autenticação:', err);
            return reply.status(500).send({ 
                success: false,
                message: "Erro interno na autenticação" 
            });
        }
    }

    /**
     * Realiza o logout do usuário
     */
    public async logout(req: FastifyRequest, reply: FastifyReply) {
        try {
            const session = (req as any).session;
            
            if (session) {
                if (typeof session.delete === 'function') {
                    session.delete();
                } else {
                    delete session.token;
                }
            }

            req.data = undefined;
            req.currentUser = undefined; // Usar currentUser

            return reply.status(200).send({ 
                success: true,
                message: "Logout realizado com sucesso" 
            });

        } catch (error) {
            console.error('Erro no logout:', error);
            return reply.status(500).send({ 
                success: false,
                message: "Erro ao fazer logout" 
            });
        }
    }

    /**
     * Verifica se o usuário atual é administrador
     */
    public isAdmin(req: FastifyRequest): boolean {
        return req.currentUser?.tipo === 'ADMIN'; // Usar currentUser
    }

    /**
     * Verifica se o usuário está autenticado
     */
    public isAuthenticated(req: FastifyRequest): boolean {
        return !!req.currentUser; // Usar currentUser
    }

    /**
     * Retorna o usuário atual
     */
    public getCurrentUser(req: FastifyRequest): Usuario | undefined {
        return req.currentUser; // Usar currentUser
    }
}

export const authService = new AuthService();