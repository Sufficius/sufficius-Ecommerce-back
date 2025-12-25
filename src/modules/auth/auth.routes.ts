import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { OAuth2Client } from "google-auth-library";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { logger } from "@/utils/logger";
import { sendResetCodeEmail } from "@/services/email.service";
import { generateToken, verifyToken } from "@/utils/jwt";
import { 
  authLimiter, 
  resetPasswordLimiter, 
  googleAuthLimiter 
} from "@/middleware/rateLimit";
import { prisma } from "@/config/prisma";

// Schemas de validação
const registerSchema = z.object({
  nome: z.string().min(3).max(100),
  email: z.string().email(),
  telefone: z.string().optional(),
  cpf: z.string().optional(),
  role: z.enum(["CLIENTE", "ADMIN", "VENDEDOR"]).default("CLIENTE")
});

const loginSchema = z.object({
  email: z.string().email().optional(),
  cpf: z.string().optional(),
  password: z.string().min(8).optional()
}).refine(data => data.email || data.cpf, {
  message: "Email ou CPF é obrigatório"
});

const forgotPasswordSchema = z.object({
  email: z.string().email()
});

const resetPasswordSchema = z.object({
  code: z.string().length(6),
  password: z.string().min(8),
  confirmPassword: z.string().min(8)
}).refine(data => data.password === data.confirmPassword, {
  message: "As s?.senhaHashs não coincidem",
  path: ["confirmPassword"]
});

const googleAuthSchema = z.object({
  token: z.string()
});

// Interfaces
interface UserPayload {
  id: number;
  email: string;
  nome: string;
  role: string;
}

interface GoogleUserInfo {
  email: string;
  name: string;
  sub: string;
  picture?: string;
  email_verified: boolean;
}

// Cliente OAuth2 Google
let googleOAuthClient: OAuth2Client | null = null;

const initGoogleOAuthClient = (): OAuth2Client | null => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  
  if (!clientId) {
    logger.warn({ 
      message: "Google OAuth Client não configurado",
      action: "Adicionar GOOGLE_CLIENT_ID ao .env"
    });
    return null;
  }
  
  return new OAuth2Client(clientId);
};

// Utilitários
const generateResetCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const generateRandomPassword = (): string => {
  return crypto.randomBytes(16).toString('hex');
};

// Serviço de autenticação
const AuthService = {
  async findOrCreateGoogleUser(googleUser: GoogleUserInfo) {
    try {
      // Buscar por email
      let user = await prisma.usuario.findUnique({
        where: { email: googleUser.email }
      });

      if (!user) {
        // Criar novo usuário
        user = await prisma.usuario.create({
          data: {
            nome: googleUser.name,
            email: googleUser.email,
            s?.senhaHash: await bcrypt.hash(generateRandomPassword(), 12),
            googleId: googleUser.sub,
            role: "CLIENTE",
            emailVerificado: googleUser.email_verified,
            foto: googleUser.picture
          }
        });
        
        logger.info({
          message: "Novo usuário Google criado",
          userId: user.id,
          email: user.email
        });
      } else if (user.googleId !== googleUser.sub) {
        // Atualizar googleId se necessário
        await prisma.usuario.update({
          where: { id: user.id },
          data: { googleId: googleUser.sub }
        });
      }

      return user;
    } catch (error) {
      logger.error({
        message: "Erro ao processar usuário Google",
        error,
        email: googleUser.email
      });
      throw error;
    }
  },

  async createUser(data: z.infer<typeof registerSchema>) {
    const hashedPassword = await bcrypt.hash(generateRandomPassword(), 12);
    
    return await prisma.usuario.create({
      data: {
        ...data,
        s?.senhaHash: hashedPassword
      },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        createdAt: true
      }
    });
  },

  async validateCredentials(email?: string, cpf?: string, password?: string) {
    const whereClause = email ? { email } : { cpf };
    
    const user = await prisma.usuario.findUnique({
      where: whereClause
    });

    if (!user) {
      return null;
    }

    if (password && user?.senhaHash) {
      const isValid = await bcrypt.compare(password, user?.senhaHash);
      if (!isValid) return null;
    }

    return user;
  },

  async processPasswordReset(email: string) {
    const user = await prisma.usuario.findUnique({ where: { email } });
    
    if (!user) {
      // Não revelar que o email não existe por segurança
      logger.debug({
        message: "Solicitação de reset para email não cadastrado",
        email
      });
      return true;
    }

    const resetCode = generateResetCode();
    const expiryDate = new Date(Date.now() + 3600000); // 1 hora

    await prisma.usuario.update({
      where: { id: user.id },
      data: {
        resetToken: resetCode,
        resetTokenExpiry: expiryDate
      }
    });

    await sendResetCodeEmail(email, resetCode, user.nome);

    logger.info({
      message: "Código de reset enviado",
      userId: user.id,
      email
    });

    return true;
  },

  async resetPassword(code: string, newPassword: string) {
    const user = await prisma.usuario.findFirst({
      where: {
        resetToken: code,
        resetTokenExpiry: { gt: new Date() }
      }
    });

    if (!user) {
      throw new Error("Código inválido ou expirado");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.usuario.update({
      where: { id: user.id },
      data: {
        s?.senhaHash: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
        ultimoLogin: new Date()
      }
    });

    logger.info({
      message: "s?.senhaHash redefinida com sucesso",
      userId: user.id
    });

    return user;
  }
};

// Handlers
const handleGoogleAuth = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { token } = googleAuthSchema.parse(request.body);
    
    if (!googleOAuthClient) {
      googleOAuthClient = initGoogleOAuthClient();
      if (!googleOAuthClient) {
        return reply.status(503).send({
          success: false,
          message: "Autenticação Google não configurada"
        });
      }
    }

    // Verificar token Google
    const ticket = await googleOAuthClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    if (!payload?.email) {
      return reply.status(400).send({
        success: false,
        message: "Token Google inválido"
      });
    }

    const googleUser: GoogleUserInfo = {
      email: payload.email,
      name: payload.name || "Usuário Google",
      sub: payload.sub,
      picture: payload.picture,
      email_verified: payload.email_verified || false
    };

    // Encontrar ou criar usuário
    const user = await AuthService.findOrCreateGoogleUser(googleUser);

    // Gerar JWT
    const authToken = generateToken({
      id: user.id,
      email: user.email,
      nome: user.nome,
      role: user.role
    });

    // Registrar login
    await prisma.usuario.update({
      where: { id: user.id },
      data: { ultimoLogin: new Date() }
    });

    logger.info({
      message: "Login Google bem-sucedido",
      userId: user.id,
      email: user.email
    });

    return reply.send({
      success: true,
      message: "Autenticação realizada com sucesso",
      token: authToken,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        role: user.role,
        foto: user.foto
      },
      expiresIn: "7d"
    });

  } catch (error: any) {
    logger.error({
      message: "Erro na autenticação Google",
      error: error.message,
      stack: error.stack
    });

    if (error.name === 'TokenError') {
      return reply.status(400).send({
        success: false,
        message: "Token Google inválido ou expirado"
      });
    }

    return reply.status(500).send({
      success: false,
      message: "Erro interno na autenticação"
    });
  }
};

const handleRegister = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const data = registerSchema.parse(request.body);

    // Verificar unicidade
    const existingUser = await prisma.usuario.findFirst({
      where: {
        OR: [
          { email: data.email },
          ...(data.cpf ? [{ cpf: data.cpf }] : [])
        ]
      }
    });

    if (existingUser) {
      const conflictField = existingUser.email === data.email ? "email" : "cpf";
      return reply.status(409).send({
        success: false,
        message: `${conflictField === 'email' ? 'Email' : 'CPF'} já está em uso`,
        field: conflictField
      });
    }

    // Criar usuário
    const user = await AuthService.createUser(data);

    // Gerar token de boas-vindas (opcional)
    const welcomeToken = generateToken({ id: user.id, email: user.email }, "24h");

    logger.info({
      message: "Novo usuário registrado",
      userId: user.id,
      email: user.email,
      role: user.role
    });

    return reply.status(201).send({
      success: true,
      message: "Usuário registrado com sucesso",
      user,
      welcomeToken,
      nextSteps: ["Verificar email", "Completar perfil"]
    });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return reply.status(400).send({
        success: false,
        message: "Dados inválidos",
        errors: error.errors
      });
    }

    logger.error({
      message: "Erro no registro",
      error: error.message
    });

    return reply.status(500).send({
      success: false,
      message: "Erro ao registrar usuário"
    });
  }
};

const handleLogin = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { email, cpf, password } = loginSchema.parse(request.body);

    const user = await AuthService.validateCredentials(email, cpf, password);
    
    if (!user) {
      return reply.status(401).send({
        success: false,
        message: "Credenciais inválidas"
      });
    }

    // Verificar se conta está ativa
    if (user.status === "INATIVO") {
      return reply.status(403).send({
        success: false,
        message: "Conta desativada. Entre em contato com o suporte."
      });
    }

    // Gerar token
    const authToken = generateToken({
      id: user.id,
      email: user.email,
      nome: user.nome,
      role: user.role
    });

    // Atualizar último login
    await prisma.usuario.update({
      where: { id: user.id },
      data: { ultimoLogin: new Date() }
    });

    // Registrar log de acesso
    await prisma.logAcesso.create({
      data: {
        usuarioId: user.id,
        ip: request.ip,
        userAgent: request.headers["user-agent"] || ""
      }
    });

    logger.info({
      message: "Login bem-sucedido",
      userId: user.id,
      email: user.email,
      method: password ? "password" : "cpf"
    });

    return reply.send({
      success: true,
      message: "Login realizado com sucesso",
      token: authToken,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        role: user.role,
        foto: user.foto
      },
      expiresIn: "7d"
    });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return reply.status(400).send({
        success: false,
        message: "Dados inválidos",
        errors: error.errors
      });
    }

    logger.error({
      message: "Erro no login",
      error: error.message
    });

    return reply.status(500).send({
      success: false,
      message: "Erro interno no login"
    });
  }
};

const handleForgotPassword = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { email } = forgotPasswordSchema.parse(request.body);
    
    await AuthService.processPasswordReset(email);

    return reply.send({
      success: true,
      message: "Se o email existir em nosso sistema, enviaremos instruções de recuperação"
    });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return reply.status(400).send({
        success: false,
        message: "Email inválido",
        errors: error.errors
      });
    }

    logger.error({
      message: "Erro no forgot-password",
      error: error.message
    });

    return reply.status(500).send({
      success: false,
      message: "Erro ao processar solicitação"
    });
  }
};

const handleResetPassword = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { code, password } = resetPasswordSchema.parse(request.body);
    
    const user = await AuthService.resetPassword(code, password);

    // Gerar novo token para login automático
    const authToken = generateToken({
      id: user.id,
      email: user.email,
      nome: user.nome,
      role: user.role
    });

    return reply.send({
      success: true,
      message: "s?.senhaHash redefinida com sucesso",
      token: authToken,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email
      }
    });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return reply.status(400).send({
        success: false,
        message: "Dados inválidos",
        errors: error.errors
      });
    }

    if (error.message === "Código inválido ou expirado") {
      return reply.status(400).send({
        success: false,
        message: error.message
      });
    }

    logger.error({
      message: "Erro no reset-password",
      error: error.message
    });

    return reply.status(500).send({
      success: false,
      message: "Erro ao redefinir s?.senhaHash"
    });
  }
};

const handleMe = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userPayload = request.user as UserPayload;

    const user = await prisma.usuario.findUnique({
      where: { id: userPayload.id },
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        cpf: true,
        role: true,
        foto: true,
        emailVerificado: true,
        createdAt: true,
        ultimoLogin: true,
        enderecos: {
          select: {
            id: true,
            logradouro: true,
            numero: true,
            complemento: true,
            bairro: true,
            cidade: true,
            estado: true,
            cep: true,
            principal: true
          }
        },
        pedidos: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            codigo: true,
            status: true,
            total: true,
            createdAt: true
          }
        }
      }
    });

    if (!user) {
      return reply.status(404).send({
        success: false,
        message: "Usuário não encontrado"
      });
    }

    return reply.send({
      success: true,
      user
    });

  } catch (error: any) {
    logger.error({
      message: "Erro ao buscar dados do usuário",
      userId: (request.user as UserPayload)?.id,
      error: error.message
    });

    return reply.status(500).send({
      success: false,
      message: "Erro ao carregar dados do usuário"
    });
  }
};

const handleRefreshToken = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userPayload = request.user as UserPayload;

    const user = await prisma.usuario.findUnique({
      where: { id: userPayload.id },
      select: { id: true, email: true, nome: true, role: true, status: true }
    });

    if (!user || user.status !== "ATIVO") {
      return reply.status(401).send({
        success: false,
        message: "Usuário não autorizado"
      });
    }

    const newToken = generateToken({
      id: user.id,
      email: user.email,
      nome: user.nome,
      role: user.role
    });

    return reply.send({
      success: true,
      token: newToken,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        role: user.role
      },
      expiresIn: "7d"
    });

  } catch (error: any) {
    logger.error({
      message: "Erro ao renovar token",
      error: error.message
    });

    return reply.status(500).send({
      success: false,
      message: "Erro ao renovar token"
    });
  }
};

const handleLogout = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const token = request.headers.authorization?.replace("Bearer ", "");
    
    if (token) {
      // Em produção, você pode adicionar o token a uma blacklist
      await prisma.tokenBlacklist.create({
        data: {
          token,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 dias
        }
      });
    }

    logger.info({
      message: "Logout realizado",
      userId: (request.user as UserPayload)?.id
    });

    return reply.send({
      success: true,
      message: "Logout realizado com sucesso"
    });

  } catch (error: any) {
    logger.error({
      message: "Erro no logout",
      error: error.message
    });

    return reply.status(500).send({
      success: false,
      message: "Erro ao realizar logout"
    });
  }
};

// Middleware de autenticação
const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    await request.jwtVerify();
    
    // Verificar se token está na blacklist
    const token = request.headers.authorization?.replace("Bearer ", "");
    if (token) {
      const blacklisted = await prisma.tokenBlacklist.findUnique({
        where: { token }
      });
      
      if (blacklisted) {
        throw new Error("Token inválido");
      }
    }
  } catch (error) {
    return reply.status(401).send({
      success: false,
      message: "Token inválido ou expirado"
    });
  }
};

// Configuração das rotas
export default async function authRoutes(app: FastifyInstance) {
  // Google OAuth
  app.post("/auth/google", 
    { preHandler: [googleAuthLimiter] }, 
    handleGoogleAuth
  );

  // Registro
  app.post("/auth/register", 
    { preHandler: [authLimiter] }, 
    handleRegister
  );

  // Login
  app.post("/auth/login", 
    { preHandler: [authLimiter] }, 
    handleLogin
  );

  // Esqueci s?.senhaHash
  app.post("/auth/forgot-password", 
    { preHandler: [resetPasswordLimiter] }, 
    handleForgotPassword
  );

  // Resetar s?.senhaHash
  app.post("/auth/reset-password", 
    { preHandler: [resetPasswordLimiter] }, 
    handleResetPassword
  );

  // Perfil do usuário
  app.get("/auth/me", 
    { preHandler: [authenticate] }, 
    handleMe
  );

  // Refresh token
  app.post("/auth/refresh", 
    { preHandler: [authenticate] }, 
    handleRefreshToken
  );

  // Logout
  app.post("/auth/logout", 
    { preHandler: [authenticate] }, 
    handleLogout
  );

  // Verificar email
  app.post("/auth/verify-email/:token", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { token } = request.params as { token: string };
      
      // Implementar verificação de email
      return reply.send({
        success: true,
        message: "Email verificado com sucesso"
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        message: "Token de verificação inválido"
      });
    }
  });

  logger.info("Rotas de autenticação registradas com sucesso");
}