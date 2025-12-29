// src/routes/auth.routes.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../../config/prisma";
import { generateToken, verifyToken } from "../../utils/jwt";

import { logger } from "../../utils/logger";
import { sendResetCodeEmail } from "../../services/nodemailer";

// Schemas de validação
const registerSchema = z.object({
  nome: z.string().min(3).max(100),
  email: z.string().email(),
  senha: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: "Senha deve conter pelo menos uma letra maiúscula, uma minúscula e um número"
  }),
  telefone: z.string().min(10).max(15).optional(),
  cpf: z.string().length(11).regex(/^\d+$/).optional(),
  tipo: z.enum(["CLIENTE", "ADMIN", "GERENTE"]).default("CLIENTE")
});

const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(8)
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

// Utilitários de senha
const hashPassword = async (senha: string): Promise<string> => {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(senha, salt);
};

const comparePassword = async (senha: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(senha, hash);
};

const generateResetCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Handlers
const handleRegister = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const data = registerSchema.parse(request.body);

    // Verificar se email já existe
    const usuarioExistente = await prisma.usuario.findUnique({
      where: { email: data.email }
    });

    if (usuarioExistente) {
      return reply.status(409).send({
        success: false,
        message: "Email já cadastrado"
      });
    }

    // Hash da senha
    const senhaHash = await hashPassword(data.senha);

    // Criar usuário
    const usuario = await prisma.usuario.create({
      data: {
        nome: data.nome,
        email: data.email,
        senhaHash,
        telefone: data.telefone ?? "",
        tipo: data.tipo,
        status: data.tipo === "CLIENTE" ? "PENDENTE" : "ATIVO",
        emailVerificado: false,
        telefoneVerificado: false
      },
      select: {
        id: true,
        nome: true,
        email: true,
        tipo: true,
        criadoEm: true
      }
    });

    // Gerar token de verificação de email
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

    await prisma.tokenVerificacao.create({
      data: {
        usuarioId: usuario.id,
        token: verificationToken,
        tipo: "EMAIL",
        expiraEm: verificationExpiry
      }
    });

    logger.info({
      message: "Novo usuário registrado",
      usuarioId: usuario.id,
      email: usuario.email,
      tipo: usuario.tipo
    });

    // TODO: Enviar email de verificação
    // await sendVerificationEmail(usuario.email, usuario.nome, verificationToken);

    return reply.status(201).send({
      success: true,
      message: "Usuário registrado com sucesso. Verifique seu email para ativar a conta.",
      usuario,
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
      error: error.message,
      stack: error.stack
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

    // Buscar usuário
    const usuario = await prisma.usuario.findUnique({
      where: { email },
      include: {
        enderecos: {
          where: { padrao: true },
          take: 1
        }
      }
    });

    if (!usuario) {
      return reply.status(401).send({
        success: false,
        message: "Credenciais inválidas"
      });
    }

    // Verificar senha
    const senhaValida = await comparePassword(senha, usuario.senhaHash);
    if (!senhaValida) {
      return reply.status(401).send({
        success: false,
        message: "Credenciais inválidas"
      });
    }

    // Verificar status da conta
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

    if (usuario.status === "DELETADO") {
      return reply.status(403).send({
        success: false,
        message: "Conta não encontrada."
      });
    }

    // Gerar token JWT
    const token = generateToken({
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
      tipo: usuario.tipo
    });

    return reply.send({
      success: true,
      message: "Login realizado com sucesso",
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        tipo: usuario.tipo,
        foto: usuario.foto,
        telefone: usuario.telefone,
        emailVerificado: usuario.emailVerificado,
        telefoneVerificado: usuario.telefoneVerificado,
        enderecoPadrao: usuario.enderecos[0] || null
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
      error: error.message,
      stack: error.stack
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

    // Buscar usuário
    const usuario = await prisma.usuario.findUnique({
      where: { email }
    });

    if (!usuario) {
      // Por segurança, não revelar se o email existe ou não
      logger.debug({
        message: "Tentativa de reset de senha para email não cadastrado",
        email
      });
      
      return reply.send({
        success: true,
        message: "Se o email existir em nosso sistema, enviaremos instruções de recuperação"
      });
    }

    // Gerar código de reset
    const resetCode = generateResetCode();
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    // Salvar código no banco
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        resetToken: resetCode,
        resetTokenExpiry: resetExpiry
      }
    });

    // Enviar email com código
    await sendResetCodeEmail(usuario.email, resetCode, usuario.nome);

    logger.info({
      message: "Código de reset enviado",
      usuarioId: usuario.id,
      email: usuario.email
    });

    return reply.send({
      success: true,
      message: "Instruções de recuperação enviadas para seu email"
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

    // Buscar usuário pelo código válido
    const usuario = await prisma.usuario.findFirst({
      where: {
        resetToken: codigo,
        resetTokenExpiry: { gt: new Date() }
      }
    });

    if (!usuario) {
      return reply.status(400).send({
        success: false,
        message: "Código inválido ou expirado"
      });
    }

    // Hash da nova senha
    const novaSenhaHash = await hashPassword(senha);

    // Atualizar senha e limpar tokens
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        senhaHash: novaSenhaHash,
        resetToken: null,
        resetTokenExpiry: null,
        ultimoLogin: new Date(),
        status: "ATIVO" // Ativar conta ao resetar senha
      }
    });

    logger.info({
      message: "Senha redefinida com sucesso",
      usuarioId: usuario.id,
      email: usuario.email
    });

    // Gerar novo token para login automático
    const token = generateToken({
      id: usuario.id,
      email: usuario.email,
      nome: usuario.nome,
      tipo: usuario.tipo
    });

    return reply.send({
      success: true,
      message: "Senha redefinida com sucesso",
      token,
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

const handleVerifyEmail = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { token } = request.params as { token: string };

    // Buscar token de verificação
    const verificationToken = await prisma.tokenVerificacao.findFirst({
      where: {
        token,
        tipo: "EMAIL",
        expiraEm: { gt: new Date() },
        usado: false
      },
      include: { usuario: true }
    });

    if (!verificationToken) {
      return reply.status(400).send({
        success: false,
        message: "Token de verificação inválido ou expirado"
      });
    }

    // Atualizar usuário como verificado
    await prisma.usuario.update({
      where: { id: verificationToken.usuarioId },
      data: {
        emailVerificado: true,
        status: "ATIVO"
      }
    });

    // Marcar token como usado
    await prisma.tokenVerificacao.update({
      where: { id: verificationToken.id },
      data: { usado: true, usadoEm: new Date() }
    });

    logger.info({
      message: "Email verificado",
      usuarioId: verificationToken.usuarioId,
      email: verificationToken.usuario.email
    });

    return reply.send({
      success: true,
      message: "Email verificado com sucesso! Sua conta está ativa."
    });

  } catch (error: any) {
    logger.error({
      message: "Erro na verificação de email",
      error: error.message
    });

    return reply.status(500).send({
      success: false,
      message: "Erro ao verificar email"
    });
  }
};

// Middleware de autenticação
const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        success: false,
        message: "Token não fornecido"
      });
    }

    const token = authHeader.substring(7); // Remove "Bearer "
    
    // Verificar token
    const decoded = verifyToken(token);
    
    // Verificar se usuário ainda existe e está ativo
    const usuario = await prisma.usuario.findUnique({
      where: { id: decoded.id }
    });

    if (!usuario || usuario.status !== "ATIVO") {
      return reply.status(401).send({
        success: false,
        message: "Usuário não autorizado"
      });
    }

    // Adicionar usuário ao request
    (request as any).user = decoded;

  } catch (error: any) {
    if (error.code === 'TOKEN_EXPIRED') {
      return reply.status(401).send({
        success: false,
        message: "Sessão expirada. Faça login novamente.",
        code: "TOKEN_EXPIRED"
      });
    }

    logger.warn({
      message: "Token inválido",
      error: error.message
    });

    return reply.status(401).send({
      success: false,
      message: "Token inválido ou expirado"
    });
  }
};

// Rotas
export default async function usuarioRoutes(app: FastifyInstance) {
  // Prefixo
  const prefix = "/usuario";

  // Registro
  app.post(`${prefix}/register`, 
    // { preHandler: [authRateLimitMiddleware.middleware()] },
    handleRegister
  );

  // Login
  app.post(`${prefix}/login`, 
    // { preHandler: [authRateLimitMiddleware] },
    handleLogin
  );

  // Esqueci senha
  app.post(`${prefix}/forgot-password`, 
    // { preHandler: [resetPasswordRateLimitMiddleware] },
    handleForgotPassword
  );

  // Resetar senha
  app.post(`${prefix}/reset-password`, 
    // { preHandler: [resetPasswordRateLimitMiddleware] },
    handleResetPassword
  );

  // Verificar email
  app.get(`${prefix}/verify-email/:token`, 
    handleVerifyEmail
  );

  // Perfil do usuário (autenticado)
  app.get(`${prefix}/me`, 
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const usuario = (request as any).user;

        const usuarioCompleto = await prisma.usuario.findUnique({
          where: { id: usuario.id },
          select: {
            id: true,
            nome: true,
            email: true,
            telefone: true,
            tipo: true,
            foto: true,
            emailVerificado: true,
            telefoneVerificado: true,
            status: true,
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
              take: 10,
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

        if (!usuarioCompleto) {
          return reply.status(404).send({
            success: false,
            message: "Usuário não encontrado"
          });
        }

        return reply.send({
          success: true,
          usuario: usuarioCompleto
        });

      } catch (error: any) {
        logger.error({
          message: "Erro ao buscar perfil",
          error: error.message
        });

        return reply.status(500).send({
          success: false,
          message: "Erro ao carregar perfil"
        });
      }
    }
  );

  logger.info(`Rotas de autenticação registradas em ${prefix}`);
}