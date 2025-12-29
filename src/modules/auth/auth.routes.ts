// src/routes.routes.ts
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { OAuth2Client } from "google-auth-library";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { logger } from "../../utils/logger";
import { sendResetCodeEmail } from "../../services/nodemailer";
import { generateToken, verifyToken } from "../../utils/jwt";
import {
  authLimiter,
  resetPasswordLimiter,
  googleAuthLimiter
} from "../../middleware/rateLimit";
import { prisma } from "../../config/prisma";

// Schemas de validação
const registerSchema = z.object({
  nome: z.string().min(3).max(100),
  email: z.string().email(),
  telefone: z.string(),
  cpf: z.string().optional(),
  tipo: z.enum(["CLIENTE", "ADMIN", "GERENTE"]).default("CLIENTE")
});

const loginSchema = z.object({
  email: z.string().email().optional(),
  cpf: z.string().optional(),
  senha: z.string().min(8).optional()
}).refine(data => data.email || data.cpf, {
  message: "Email ou CPF é obrigatório"
});

const forgotPasswordSchema = z.object({
  email: z.string().email()
});

const resetPasswordSchema = z.object({
  codigo: z.string().length(6),
  senha: z.string().min(8),
  confirmarSenha: z.string().min(8)
}).refine(data => data.senha === data.confirmarSenha, {
  message: "As senhas não coincidem",
  path: ["confirmarSenha"]
});

const googleAuthSchema = z.object({
  token: z.string()
});

// Interfaces
interface UserPayload {
  id: string;
  email: string;
  nome: string;
  tipo: string;
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
      let usuario = await prisma.usuario.findUnique({
        where: { email: googleUser.email }
      });

      if (!usuario) {
        // Criar novo usuário
        usuario = await prisma.usuario.create({
          data: {
            nome: googleUser.name,
            email: googleUser.email,
            senhaHash: await bcrypt.hash(generateRandomPassword(), 12),
            googleId: googleUser.sub,
            tipo: "CLIENTE",
            emailVerificado: googleUser.email_verified,
            foto: googleUser.picture,
            telefone: ""
          }
        });

        logger.info({
          message: "Novo usuário Google criado",
          usuarioId: usuario.id,
          email: usuario.email
        });
      } else if (usuario.googleId !== googleUser.sub) {
        // Atualizar googleId se necessário
        await prisma.usuario.update({
          where: { id: usuario.id },
          data: { googleId: googleUser.sub }
        });
      }

      return usuario;
    } catch (error) {
      logger.error({
        message: "Erro ao processar usuário Google",
        error,
        email: googleUser.email
      });
      throw error;
    }
  },

  async createUsuario(data: z.infer<typeof registerSchema>) {
    const hashedPassword = await bcrypt.hash(generateRandomPassword(), 12);

    return await prisma.usuario.create({
      data: {
        nome: data.nome,
        email: data.email,
        telefone: data.telefone,
        tipo: data.tipo,
        senhaHash: hashedPassword,
        status: "PENDENTE" // Status inicial
      },
      select: {
        id: true,
        nome: true,
        email: true,
        tipo: true,
        criadoEm: true
      }
    });
  },

  async validateCredentials(email?: string, senha?: string) {
    const usuario = await prisma.usuario.findUnique({
      where: {
        email: email
      }
    });

    if (!usuario) {
      return null;
    }

    if (senha && usuario.senhaHash) {
      const isValid = await bcrypt.compare(senha, usuario.senhaHash);
      if (!isValid) return null;
    }

    return usuario;
  },

  async processPasswordReset(email: string) {
    const usuario = await prisma.usuario.findUnique({ where: { email } });

    if (!usuario) {
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
      where: { id: usuario.id },
      data: {
        resetToken: resetCode,
        resetTokenExpiry: expiryDate
      }
    });

    await sendResetCodeEmail(email, resetCode, usuario.nome);

    logger.info({
      message: "Código de reset enviado",
      usuarioId: usuario.id,
      email
    });

    return true;
  },

  async resetPassword(codigo: string, novaSenha: string) {
    const usuario = await prisma.usuario.findFirst({
      where: {
        resetToken: codigo,
        resetTokenExpiry: { gt: new Date() }
      }
    });

    if (!usuario) {
      throw new Error("Código inválido ou expirado");
    }

    const hashedPassword = await bcrypt.hash(novaSenha, 12);

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        senhaHash: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
        ultimoLogin: new Date(),
        status: "ATIVO" // Ativar conta ao resetar senha
      }
    });

    logger.info({
      message: "Senha redefinida com sucesso",
      usuarioId: usuario.id
    });

    return usuario;
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
    const usuario = await AuthService.findOrCreateGoogleUser(googleUser);

    // Gerar JWT
    const authToken = generateToken({
      id: usuario.id,
      email: usuario.email,
      nome: usuario.nome,
      tipo: usuario.tipo
    });

    // Registrar login
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoLogin: new Date() }
    });

    logger.info({
      message: "Login Google bem-sucedido",
      usuarioId: usuario.id,
      email: usuario.email
    });

    return reply.send({
      success: true,
      message: "Autenticação realizada com sucesso",
      token: authToken,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        tipo: usuario.tipo,
        foto: usuario.foto
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
    const existingUsuario = await prisma.usuario.findFirst({
      where: {
        OR: [
          { email: data.email },
          ...(data.telefone ? [{ telefone: data.telefone }] : [])
        ]
      }
    });

    if (existingUsuario) {
      const conflictField = existingUsuario.email === data.email ? "email" :
        existingUsuario.telefone === data.telefone;
      return reply.status(409).send({
        success: false,
        message: `${conflictField === 'email' ? 'Email' : 'Telefone'} já está em uso`,
        field: conflictField
      });
    }

    // Criar usuário
    const usuario = await AuthService.createUsuario(data);

    // Gerar token de boas-vindas (opcional)
    const welcomeToken = generateToken({ id: usuario.id, email: usuario.email }, "24h");

    logger.info({
      message: "Novo usuário registrado",
      usuarioId: usuario.id,
      email: usuario.email,
      tipo: usuario.tipo
    });

    return reply.status(201).send({
      success: true,
      message: "Usuário registrado com sucesso",
      usuario,
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
    const { email, senha } = loginSchema.parse(request.body);

    const usuario = await AuthService.validateCredentials(email, senha);

    if (!usuario) {
      return reply.status(401).send({
        success: false,
        message: "Credenciais inválidas"
      });
    }

    // Verificar se conta está ativa
    if (usuario.status === "SUSPENSO") {
      return reply.status(403).send({
        success: false,
        message: "Conta suspensa. Entre em contato com o suporte."
      });
    }

    if (usuario.status === "PENDENTE") {
      return reply.status(403).send({
        success: false,
        message: "Conta pendente de verificação. Verifique seu email."
      });
    }

    // Gerar token
    const authToken = generateToken({
      id: usuario.id,
      email: usuario.email,
      nome: usuario.nome,
      tipo: usuario.tipo
    });

    // Atualizar último login
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoLogin: new Date() }
    });

    logger.info({
      message: "Login bem-sucedido",
      usuarioId: usuario.id,
      email: usuario.email,
      method: senha ? "senha" : "cpf"
    });

    return reply.send({
      success: true,
      message: "Login realizado com sucesso",
      token: authToken,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        tipo: usuario.tipo,
        foto: usuario.foto
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
    const { codigo, senha } = resetPasswordSchema.parse(request.body);

    const usuario = await AuthService.resetPassword(codigo, senha);

    // Gerar novo token para login automático
    const authToken = generateToken({
      id: usuario.id,
      email: usuario.email,
      nome: usuario.nome,
      tipo: usuario.tipo
    });

    return reply.send({
      success: true,
      message: "Senha redefinida com sucesso",
      token: authToken,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email
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
      message: "Erro ao redefinir senha"
    });
  }
};

const handleMe = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const usuarioPayload = request.user as UserPayload;

    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioPayload.id },
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        tipo: true,
        foto: true,
        emailVerificado: true,
        criadoEm: true,
        ultimoLogin: true,
        enderecos: {
          select: {
            id: true,
            rua: true,
            numero: true,
            complemento: true,
            bairro: true,
            cidade: true,
            estado: true,
            cep: true,
            pais: true,
            padrao: true
          }
        },
        pedidos: {
          take: 5,
          orderBy: { criadoEm: 'desc' },
          select: {
            id: true,
            numeroPedido: true,
            status: true,
            total: true,
            criadoEm: true
          }
        }
      }
    });

    if (!usuario) {
      return reply.status(404).send({
        success: false,
        message: "Usuário não encontrado"
      });
    }

    return reply.send({
      success: true,
      usuario
    });

  } catch (error: any) {
    logger.error({
      message: "Erro ao buscar dados do usuário",
      usuarioId: (request.user as UserPayload)?.id,
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
    const usuarioPayload = request.user as UserPayload;

    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioPayload.id },
      select: { id: true, email: true, nome: true, tipo: true, status: true }
    });

    if (!usuario || usuario.status !== "ATIVO") {
      return reply.status(401).send({
        success: false,
        message: "Usuário não autorizado"
      });
    }

    const newToken = generateToken({
      id: usuario.id,
      email: usuario.email,
      nome: usuario.nome,
      tipo: usuario.tipo
    });

    return reply.send({
      success: true,
      token: newToken,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        tipo: usuario.tipo
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
      // Crie uma tabela TokenBlacklist no seu schema se necessário
      // await prisma.tokenBlacklist.create({
      //   data: {
      //     token,
      //     expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 dias
      //   }
      // });
    }

    logger.info({
      message: "Logout realizado",
      usuarioId: (request.user as UserPayload)?.id
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

    // Verificar se token está na blacklist (se implementar)
    // const token = request.headers.authorization?.replace("Bearer ", "");
    // if (token) {
    //   const blacklisted = await prisma.tokenBlacklist.findUnique({
    //     where: { token }
    //   });
    //   
    //   if (blacklisted) {
    //     throw new Error("Token inválido");
    //   }
    // }
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
  app.post("/google",
    { preHandler: [googleAuthLimiter.middleware()] },
    handleGoogleAuth
  );

  // Registro
  app.post("/register",
    { preHandler: [authLimiter.middleware()] },
    handleRegister
  );

  // Login
  app.post("/login",
    { preHandler: [authLimiter.middleware()] },
    handleLogin
  );

  // Esqueci senha
  app.post("/forgot-password",
    { preHandler: [resetPasswordLimiter.middleware()] },
    handleForgotPassword
  );

  // Resetar senha
  app.post("/reset-password",
    { preHandler: [resetPasswordLimiter.middleware()] },
    handleResetPassword
  );

  // Perfil do usuário
  app.get("/me",
    { preHandler: [authenticate] },
    handleMe
  );

  // Refresh token
  app.post("/refresh",
    { preHandler: [authenticate] },
    handleRefreshToken
  );

  // Logout
  app.post("/logout",
    { preHandler: [authenticate] },
    handleLogout
  );

  // Verificar email
  app.post("/verify-email/:token", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { token } = request.params as { token: string };

      // Buscar usuário pelo token de verificação
      const usuario = await prisma.usuario.findFirst({
        where: {
          resetToken: token,
          resetTokenExpiry: { gt: new Date() }
        }
      });

      if (!usuario) {
        return reply.status(400).send({
          success: false,
          message: "Token de verificação inválido ou expirado"
        });
      }

      // Atualizar usuário como verificado
      await prisma.usuario.update({
        where: { id: usuario.id },
        data: {
          emailVerificado: true,
          status: "ATIVO",
          resetToken: null,
          resetTokenExpiry: null
        }
      });

      logger.info({
        message: "Email verificado",
        usuarioId: usuario.id,
        email: usuario.email
      });

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