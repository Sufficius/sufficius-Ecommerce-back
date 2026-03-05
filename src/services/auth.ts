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
    }
}

class AuthService {
    constructor() {
        // Chama a configuração do Passport no construtor
        this.configurePassport();
    }

    /**
     * Extrai o token JWT da sessão
     */
    private extractJwtFromSession = (req: FastifyRequest): string | null => {
        try {
            // Acessa a sessão com type assertion
            const session = (req as any).session;
            if (session?.token) {
                return session.token;
            }
            return null;
        } catch (error) {
            console.error('Erro ao extrair token da sessão:', error);
            return null;
        }
    }

    /**
     * Configura a estratégia JWT do Passport
     */
    private configurePassport(): void {
        const opts: StrategyOptions = {
            // Tenta extrair o token da sessão primeiro, depois do header Authorization
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
                    // Busca o usuário pelo ID ou nome do payload
                    const usuarioId = payload.id || payload.sub;
                    
                    let usuario: Usuario | null = null;
                    
                    if (usuarioId) {
                        // Tenta buscar por ID
                        usuario = await userModel.getByEmail(usuarioId);
                    } else if (payload.nome) {
                        // Tenta buscar por nome (fallback)
                        usuario = await userModel.getByName(payload.nome);
                    }

                    if (!usuario) {
                        return done(null, false, { message: "Usuário não encontrado" });
                    }

                    // Retorna o usuário autenticado
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
        // Payload com informações essenciais
        const payload = {
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            tipo: usuario.tipo
        };

        // Configura a expiração do token
        const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
        
        // Opções de assinatura
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
     * Verifica e retorna o usuário da requisição
     */
    async verifyUser(req: FastifyRequest): Promise<Usuario | null> {
        try {
            // Se o usuário já estiver anexado, retorna
            if (req.user) {
                return req.user as Usuario;
            }

            // Se tiver dados no req.data, tenta buscar o usuário
            if (req.data) {
                const payload = req.data as JwtPayload;
                const usuarioId = payload.id || payload.sub;
                
                if (usuarioId) {
       
                    const usuario = await userModel.getByEmail(usuarioId);
                    if (usuario) {
                        req.user = usuario;
                        return usuario;
                    }
                }
            }

            return null;
        } catch (error) {
            console.error('Erro ao verificar usuário:', error);
            return null;
        }
    }

    /**
     * Realiza o login do usuário
     */
    public async login(req: FastifyRequest, usuario: Partial<Usuario>): Promise<void> {
        try {
            const token = await this.generateToken(usuario);
            
            // Acessa a sessão com type assertion
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
            // Acessa a sessão com type assertion
            const session = (req as any).session;
            const token = session?.token;

            if (!token) {
                return reply.status(401).send({ 
                    success: false,
                    message: "Token não fornecido" 
                });
            }

            // Verifica o token
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

            // Busca o usuário no banco
            const usuario = await userModel.getByName(decoded.id);

            if (!usuario) {
                return reply.status(401).send({ 
                    success: false,
                    message: "Usuário não encontrado" 
                });
            }

            // Anexa o usuário e os dados à requisição
            req.data = decoded;
            req.user = usuario;

            // Retorna os dados do usuário (opcional)
            return {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email,
                tipo: usuario.tipo
            };

        } catch (err) {
            // Tratamento específico para erros JWT
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

            // Erro genérico
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
            // Acessa a sessão com type assertion
            const session = (req as any).session;
            
            if (session) {
                if (typeof session.delete === 'function') {
                    // Método delete do @fastify/secure-session
                    session.delete();
                } else {
                    // Fallback: remove apenas o token
                    delete session.token;
                }
            }

            // Remove dados da requisição
            req.data = undefined;
            req.user =  undefined as any;

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
     * Retorna o usuário atual da requisição
     */
    public getCurrentUser(req: FastifyRequest): Usuario | undefined {
        return req.user as Usuario | undefined;
    }

    /**
     * Verifica se o usuário atual é administrador
     */
    public isAdmin(req: FastifyRequest): boolean {
        return req.user?.tipo === 'ADMIN';
    }

    /**
     * Verifica se o usuário está autenticado
     */
    public isAuthenticated(req: FastifyRequest): boolean {
        return !!req.user;
    }
}

// Exporta uma instância única do serviço (singleton)
export const authService = new AuthService();