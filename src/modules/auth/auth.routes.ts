// // src/routes.routes.ts
// import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
// import { z } from "zod";
// import { OAuth2Client } from "google-auth-library";
// import bcrypt from "bcryptjs";
// import crypto from "crypto";
// import { logger } from "../../utils/logger";
// import { sendResetCodeEmail } from "../../services/nodemailer";
// import { generateToken, verifyToken } from "../../utils/jwt";
// import {
//   authLimiter,
//   resetPasswordLimiter,
//   googleAuthLimiter
// } from "../../middleware/rateLimit";
// import { prisma } from "../../config/prisma";

// // Schemas de validação
// const registerSchema = z.object({
//   nome: z.string().min(3).max(100),
//   email: z.string().email(),
//   telefone: z.string(),
//   cpf: z.string().optional(),
//   tipo: z.enum(["CLIENTE", "ADMIN", "GERENTE"]).default("CLIENTE")
// });

// const loginSchema = z.object({
//   email: z.string().email().optional(),
//   cpf: z.string().optional(),
//   senha: z.string().min(8).optional()
// }).refine(data => data.email || data.cpf, {
//   message: "Email ou CPF é obrigatório"
// });

// const forgotPasswordSchema = z.object({
//   email: z.string().email()
// });

// const resetPasswordSchema = z.object({
//   codigo: z.string().length(6),
//   senha: z.string().min(8),
//   confirmarSenha: z.string().min(8)
// }).refine(data => data.senha === data.confirmarSenha, {
//   message: "As senhas não coincidem",
//   path: ["confirmarSenha"]
// });

// const googleAuthSchema = z.object({
//   token: z.string()
// });

// // Interfaces
// interface UserPayload {
//   id: string;
//   email: string;
//   nome: string;
//   tipo: string;
// }

// interface GoogleUserInfo {
//   email: string;
//   name: string;
//   sub: string;
//   picture?: string;
//   email_verified: boolean;
// }

// // Cliente OAuth2 Google
// let googleOAuthClient: OAuth2Client | null = null;

// const initGoogleOAuthClient = (): OAuth2Client | null => {
//   const clientId = process.env.GOOGLE_CLIENT_ID;

//   if (!clientId) {
//     logger.warn({
//       message: "Google OAuth Client não configurado",
//       action: "Adicionar GOOGLE_CLIENT_ID ao .env"
//     });
//     return null;
//   }

//   return new OAuth2Client(clientId);
// };

// // Utilitários
// const generateResetCode = (): string => {
//   return Math.floor(100000 + Math.random() * 900000).toString();
// };

// const generateRandomPassword = (): string => {
//   return crypto.randomBytes(16).toString('hex');
// };

// // Serviço de autenticação
// const AuthService = {
//   async findOrCreateGoogleUser(googleUser: GoogleUserInfo) {
//     try {
//       // Buscar por email
//       let usuario = await prisma.usuario.findUnique({
//         where: { email: googleUser.email }
//       });

//       if (!usuario) {
//         // Criar novo usuário
//         usuario = await prisma.usuario.create({
//           data: {
//             nome: googleUser.name,
//             email: googleUser.email,
//             senhaHash: await bcrypt.hash(generateRandomPassword(), 12),
//             googleId: googleUser.sub,
//             tipo: "CLIENTE",
//             emailVerificado: googleUser.email_verified,
//             foto: googleUser.picture,
//             telefone: ""
//           }
//         });

//         logger.info({
//           message: "Novo usuário Google criado",
//           usuarioId: usuario.id,
//           email: usuario.email
//         });
//       } else if (usuario.googleId !== googleUser.sub) {
//         // Atualizar googleId se necessário
//         await prisma.usuario.update({
//           where: { id: usuario.id },
//           data: { googleId: googleUser.sub }
//         });
//       }

//       return usuario;
//     } catch (error) {
//       logger.error({
//         message: "Erro ao processar usuário Google",
//         error,
//         email: googleUser.email
//       });
//       throw error;
//     }
//   },

//   async createUsuario(data: z.infer<typeof registerSchema>) {
//     const hashedPassword = await bcrypt.hash(generateRandomPassword(), 12);

//     return await prisma.usuario.create({
//       data: {
//         nome: data.nome,
//         email: data.email,
//         telefone: data.telefone,
//         tipo: data.tipo,
//         senhaHash: hashedPassword,
//         status: "PENDENTE" // Status inicial
//       },
//       select: {
//         id: true,
//         nome: true,
//         email: true,
//         tipo: true,
//         criadoEm: true
//       }
//     });
//   },

//   async validateCredentials(email?: string, senha?: string) {
//     const usuario = await prisma.usuario.findUnique({
//       where: {
//         email: email
//       }
//     });

//     if (!usuario) {
//       return null;
//     }

//     if (senha && usuario.senhaHash) {
//       const isValid = await bcrypt.compare(senha, usuario.senhaHash);
//       if (!isValid) return null;
//     }

//     return usuario;
//   },

//   async processPasswordReset(email: string) {
//     const usuario = await prisma.usuario.findUnique({ where: { email } });

//     if (!usuario) {
//       // Não revelar que o email não existe por segurança
//       logger.debug({
//         message: "Solicitação de reset para email não cadastrado",
//         email
//       });
//       return true;
//     }

//     const resetCode = generateResetCode();
//     const expiryDate = new Date(Date.now() + 3600000); // 1 hora

//     await prisma.usuario.update({
//       where: { id: usuario.id },
//       data: {
//         resetToken: resetCode,
//         resetTokenExpiry: expiryDate
//       }
//     });

//     await sendResetCodeEmail(email, resetCode, usuario.nome);

//     logger.info({
//       message: "Código de reset enviado",
//       usuarioId: usuario.id,
//       email
//     });

//     return true;
//   },

//   async resetPassword(codigo: string, novaSenha: string) {
//     const usuario = await prisma.usuario.findFirst({
//       where: {
//         resetToken: codigo,
//         resetTokenExpiry: { gt: new Date() }
//       }
//     });

//     if (!usuario) {
//       throw new Error("Código inválido ou expirado");
//     }

//     const hashedPassword = await bcrypt.hash(novaSenha, 12);

//     await prisma.usuario.update({
//       where: { id: usuario.id },
//       data: {
//         senhaHash: hashedPassword,
//         resetToken: null,
//         resetTokenExpiry: null,
//         ultimoLogin: new Date(),
//         status: "ATIVO" // Ativar conta ao resetar senha
//       }
//     });

//     logger.info({
//       message: "Senha redefinida com sucesso",
//       usuarioId: usuario.id
//     });

//     return usuario;
//   }
// };

// // Handlers
// const handleGoogleAuth = async (request: FastifyRequest, reply: FastifyReply) => {
//   try {
//     const { token } = googleAuthSchema.parse(request.body);

//     if (!googleOAuthClient) {
//       googleOAuthClient = initGoogleOAuthClient();
//       if (!googleOAuthClient) {
//         return reply.status(503).send({
//           success: false,
//           message: "Autenticação Google não configurada"
//         });
//       }
//     }

//     // Verificar token Google
//     const ticket = await googleOAuthClient.verifyIdToken({
//       idToken: token,
//       audience: process.env.GOOGLE_CLIENT_ID
//     });

//     const payload = ticket.getPayload();
//     if (!payload?.email) {
//       return reply.status(400).send({
//         success: false,
//         message: "Token Google inválido"
//       });
//     }

//     const googleUser: GoogleUserInfo = {
//       email: payload.email,
//       name: payload.name || "Usuário Google",
//       sub: payload.sub,
//       picture: payload.picture,
//       email_verified: payload.email_verified || false
//     };

//     // Encontrar ou criar usuário
//     const usuario = await AuthService.findOrCreateGoogleUser(googleUser);

//     // Gerar JWT
//     const authToken = generateToken({
//       id: usuario.id,
//       email: usuario.email,
//       nome: usuario.nome,
//       tipo: usuario.tipo
//     });

//     // Registrar login
//     await prisma.usuario.update({
//       where: { id: usuario.id },
//       data: { ultimoLogin: new Date() }
//     });

//     logger.info({
//       message: "Login Google bem-sucedido",
//       usuarioId: usuario.id,
//       email: usuario.email
//     });

//     return reply.send({
//       success: true,
//       message: "Autenticação realizada com sucesso",
//       token: authToken,
//       usuario: {
//         id: usuario.id,
//         nome: usuario.nome,
//         email: usuario.email,
//         tipo: usuario.tipo,
//         foto: usuario.foto
//       },
//       expiresIn: "7d"
//     });

//   } catch (error: any) {
//     logger.error({
//       message: "Erro na autenticação Google",
//       error: error.message,
//       stack: error.stack
//     });

//     if (error.name === 'TokenError') {
//       return reply.status(400).send({
//         success: false,
//         message: "Token Google inválido ou expirado"
//       });
//     }

//     return reply.status(500).send({
//       success: false,
//       message: "Erro interno na autenticação"
//     });
//   }
// };

// const handleRegister = async (request: FastifyRequest, reply: FastifyReply) => {
//   try {
//     const data = registerSchema.parse(request.body);

//     // Verificar unicidade
//     const existingUsuario = await prisma.usuario.findFirst({
//       where: {
//         OR: [
//           { email: data.email },
//           ...(data.telefone ? [{ telefone: data.telefone }] : [])
//         ]
//       }
//     });

//     if (existingUsuario) {
//       const conflictField = existingUsuario.email === data.email ? "email" :
//         existingUsuario.telefone === data.telefone;
//       return reply.status(409).send({
//         success: false,
//         message: `${conflictField === 'email' ? 'Email' : 'Telefone'} já está em uso`,
//         field: conflictField
//       });
//     }

//     // Criar usuário
//     const usuario = await AuthService.createUsuario(data);

//     // Gerar token de boas-vindas (opcional)
//     const welcomeToken = generateToken({ id: usuario.id, email: usuario.email }, "24h");

//     logger.info({
//       message: "Novo usuário registrado",
//       usuarioId: usuario.id,
//       email: usuario.email,
//       tipo: usuario.tipo
//     });

//     return reply.status(201).send({
//       success: true,
//       message: "Usuário registrado com sucesso",
//       usuario,
//       welcomeToken,
//       nextSteps: ["Verificar email", "Completar perfil"]
//     });

//   } catch (error: any) {
//     if (error instanceof z.ZodError) {
//       return reply.status(400).send({
//         success: false,
//         message: "Dados inválidos",
//         errors: error.errors
//       });
//     }

//     logger.error({
//       message: "Erro no registro",
//       error: error.message
//     });

//     return reply.status(500).send({
//       success: false,
//       message: "Erro ao registrar usuário"
//     });
//   }
// };

// const handleLogin = async (request: FastifyRequest, reply: FastifyReply) => {
//   try {
//     const { email, senha } = loginSchema.parse(request.body);

//     const usuario = await AuthService.validateCredentials(email, senha);

//     if (!usuario) {
//       return reply.status(401).send({
//         success: false,
//         message: "Credenciais inválidas"
//       });
//     }

//     // Verificar se conta está ativa
//     if (usuario.status === "SUSPENSO") {
//       return reply.status(403).send({
//         success: false,
//         message: "Conta suspensa. Entre em contato com o suporte."
//       });
//     }

//     if (usuario.status === "PENDENTE") {
//       return reply.status(403).send({
//         success: false,
//         message: "Conta pendente de verificação. Verifique seu email."
//       });
//     }

//     // Gerar token
//     const authToken = generateToken({
//       id: usuario.id,
//       email: usuario.email,
//       nome: usuario.nome,
//       tipo: usuario.tipo
//     });

//     // Atualizar último login
//     await prisma.usuario.update({
//       where: { id: usuario.id },
//       data: { ultimoLogin: new Date() }
//     });

//     logger.info({
//       message: "Login bem-sucedido",
//       usuarioId: usuario.id,
//       email: usuario.email,
//       method: senha ? "senha" : "cpf"
//     });

//     return reply.send({
//       success: true,
//       message: "Login realizado com sucesso",
//       token: authToken,
//       usuario: {
//         id: usuario.id,
//         nome: usuario.nome,
//         email: usuario.email,
//         tipo: usuario.tipo,
//         foto: usuario.foto
//       },
//       expiresIn: "7d"
//     });

//   } catch (error: any) {
//     if (error instanceof z.ZodError) {
//       return reply.status(400).send({
//         success: false,
//         message: "Dados inválidos",
//         errors: error.errors
//       });
//     }

//     logger.error({
//       message: "Erro no login",
//       error: error.message
//     });

//     return reply.status(500).send({
//       success: false,
//       message: "Erro interno no login"
//     });
//   }
// };

// const handleForgotPassword = async (request: FastifyRequest, reply: FastifyReply) => {
//   try {
//     const { email } = forgotPasswordSchema.parse(request.body);

//     await AuthService.processPasswordReset(email);

//     return reply.send({
//       success: true,
//       message: "Se o email existir em nosso sistema, enviaremos instruções de recuperação"
//     });

//   } catch (error: any) {
//     if (error instanceof z.ZodError) {
//       return reply.status(400).send({
//         success: false,
//         message: "Email inválido",
//         errors: error.errors
//       });
//     }

//     logger.error({
//       message: "Erro no forgot-password",
//       error: error.message
//     });

//     return reply.status(500).send({
//       success: false,
//       message: "Erro ao processar solicitação"
//     });
//   }
// };

// const handleResetPassword = async (request: FastifyRequest, reply: FastifyReply) => {
//   try {
//     const { codigo, senha } = resetPasswordSchema.parse(request.body);

//     const usuario = await AuthService.resetPassword(codigo, senha);

//     // Gerar novo token para login automático
//     const authToken = generateToken({
//       id: usuario.id,
//       email: usuario.email,
//       nome: usuario.nome,
//       tipo: usuario.tipo
//     });

//     return reply.send({
//       success: true,
//       message: "Senha redefinida com sucesso",
//       token: authToken,
//       usuario: {
//         id: usuario.id,
//         nome: usuario.nome,
//         email: usuario.email
//       }
//     });

//   } catch (error: any) {
//     if (error instanceof z.ZodError) {
//       return reply.status(400).send({
//         success: false,
//         message: "Dados inválidos",
//         errors: error.errors
//       });
//     }

//     if (error.message === "Código inválido ou expirado") {
//       return reply.status(400).send({
//         success: false,
//         message: error.message
//       });
//     }

//     logger.error({
//       message: "Erro no reset-password",
//       error: error.message
//     });

//     return reply.status(500).send({
//       success: false,
//       message: "Erro ao redefinir senha"
//     });
//   }
// };

// const handleMe = async (request: FastifyRequest, reply: FastifyReply) => {
//   try {
//     const usuarioPayload = request.user as UserPayload;

//     const usuario = await prisma.usuario.findUnique({
//       where: { id: usuarioPayload.id },
//       select: {
//         id: true,
//         nome: true,
//         email: true,
//         telefone: true,
//         tipo: true,
//         foto: true,
//         emailVerificado: true,
//         criadoEm: true,
//         ultimoLogin: true,
//         enderecos: {
//           select: {
//             id: true,
//             rua: true,
//             numero: true,
//             complemento: true,
//             bairro: true,
//             cidade: true,
//             estado: true,
//             cep: true,
//             pais: true,
//             padrao: true
//           }
//         },
//         pedidos: {
//           take: 5,
//           orderBy: { criadoEm: 'desc' },
//           select: {
//             id: true,
//             numeroPedido: true,
//             status: true,
//             total: true,
//             criadoEm: true
//           }
//         }
//       }
//     });

//     if (!usuario) {
//       return reply.status(404).send({
//         success: false,
//         message: "Usuário não encontrado"
//       });
//     }

//     return reply.send({
//       success: true,
//       usuario
//     });

//   } catch (error: any) {
//     logger.error({
//       message: "Erro ao buscar dados do usuário",
//       usuarioId: (request.user as UserPayload)?.id,
//       error: error.message
//     });

//     return reply.status(500).send({
//       success: false,
//       message: "Erro ao carregar dados do usuário"
//     });
//   }
// };

// const handleRefreshToken = async (request: FastifyRequest, reply: FastifyReply) => {
//   try {
//     const usuarioPayload = request.user as UserPayload;

//     const usuario = await prisma.usuario.findUnique({
//       where: { id: usuarioPayload.id },
//       select: { id: true, email: true, nome: true, tipo: true, status: true }
//     });

//     if (!usuario || usuario.status !== "ATIVO") {
//       return reply.status(401).send({
//         success: false,
//         message: "Usuário não autorizado"
//       });
//     }

//     const newToken = generateToken({
//       id: usuario.id,
//       email: usuario.email,
//       nome: usuario.nome,
//       tipo: usuario.tipo
//     });

//     return reply.send({
//       success: true,
//       token: newToken,
//       usuario: {
//         id: usuario.id,
//         nome: usuario.nome,
//         email: usuario.email,
//         tipo: usuario.tipo
//       },
//       expiresIn: "7d"
//     });

//   } catch (error: any) {
//     logger.error({
//       message: "Erro ao renovar token",
//       error: error.message
//     });

//     return reply.status(500).send({
//       success: false,
//       message: "Erro ao renovar token"
//     });
//   }
// };

// const handleLogout = async (request: FastifyRequest, reply: FastifyReply) => {
//   try {
//     const token = request.headers.authorization?.replace("Bearer ", "");

//     if (token) {
//       // Em produção, você pode adicionar o token a uma blacklist
//       // Crie uma tabela TokenBlacklist no seu schema se necessário
//       // await prisma.tokenBlacklist.create({
//       //   data: {
//       //     token,
//       //     expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 dias
//       //   }
//       // });
//     }

//     logger.info({
//       message: "Logout realizado",
//       usuarioId: (request.user as UserPayload)?.id
//     });

//     return reply.send({
//       success: true,
//       message: "Logout realizado com sucesso"
//     });

//   } catch (error: any) {
//     logger.error({
//       message: "Erro no logout",
//       error: error.message
//     });

//     return reply.status(500).send({
//       success: false,
//       message: "Erro ao realizar logout"
//     });
//   }
// };

// // Middleware de autenticação
// const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
//   try {
//     await request.jwtVerify();

//     // Verificar se token está na blacklist (se implementar)
//     // const token = request.headers.authorization?.replace("Bearer ", "");
//     // if (token) {
//     //   const blacklisted = await prisma.tokenBlacklist.findUnique({
//     //     where: { token }
//     //   });
//     //   
//     //   if (blacklisted) {
//     //     throw new Error("Token inválido");
//     //   }
//     // }
//   } catch (error) {
//     return reply.status(401).send({
//       success: false,
//       message: "Token inválido ou expirado"
//     });
//   }
// };

// // Configuração das rotas
// export default async function authRoutes(app: FastifyInstance) {
//   // Google OAuth
//   app.post("/google",
//     { preHandler: [googleAuthLimiter.middleware()] },
//     handleGoogleAuth
//   );

//   // Registro
//   app.post("/register",
//     { preHandler: [authLimiter.middleware()] },
//     handleRegister
//   );

//   // Login
//   app.post("/login",
//     { preHandler: [authLimiter.middleware()] },
//     handleLogin
//   );

//   // Esqueci senha
//   app.post("/forgot-password",
//     { preHandler: [resetPasswordLimiter.middleware()] },
//     handleForgotPassword
//   );

//   // Resetar senha
//   app.post("/reset-password",
//     { preHandler: [resetPasswordLimiter.middleware()] },
//     handleResetPassword
//   );

//   // Perfil do usuário
//   app.get("/me",
//     { preHandler: [authenticate] },
//     handleMe
//   );

//   // Refresh token
//   app.post("/refresh",
//     { preHandler: [authenticate] },
//     handleRefreshToken
//   );

//   // Logout
//   app.post("/logout",
//     { preHandler: [authenticate] },
//     handleLogout
//   );

//   // Verificar email
//   app.post("/verify-email/:token", async (request: FastifyRequest, reply: FastifyReply) => {
//     try {
//       const { token } = request.params as { token: string };

//       // Buscar usuário pelo token de verificação
//       const usuario = await prisma.usuario.findFirst({
//         where: {
//           resetToken: token,
//           resetTokenExpiry: { gt: new Date() }
//         }
//       });

//       if (!usuario) {
//         return reply.status(400).send({
//           success: false,
//           message: "Token de verificação inválido ou expirado"
//         });
//       }

//       // Atualizar usuário como verificado
//       await prisma.usuario.update({
//         where: { id: usuario.id },
//         data: {
//           emailVerificado: true,
//           status: "ATIVO",
//           resetToken: null,
//           resetTokenExpiry: null
//         }
//       });

//       logger.info({
//         message: "Email verificado",
//         usuarioId: usuario.id,
//         email: usuario.email
//       });

//       return reply.send({
//         success: true,
//         message: "Email verificado com sucesso"
//       });
//     } catch (error) {
//       return reply.status(400).send({
//         success: false,
//         message: "Token de verificação inválido"
//       });
//     }
//   });

//   logger.info("Rotas de autenticação registradas com sucesso");
// }

import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../config/prisma";
import { OAuth2Client } from "google-auth-library";
import { sendResetCodeEmail } from "../../services/nodemailer";
import { hashPassword } from "../../utils/hash";

// Interface para o usuário no JWT
interface UserPayload {
  id: string;
  email: string;
 
}

let googleOAuthClient: OAuth2Client | null = null;


function initGoogleOAuth() {
  const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  
  if (!CLIENT_ID) {
    console.warn('⚠️  GOOGLE_CLIENT_ID não definido no ambiente. Login Google desabilitado.');
    console.warn('ℹ️  Adicione GOOGLE_CLIENT_ID ao seu arquivo .env');
    return null;
  }
  
  console.log('✅ Google OAuth2 client inicializado com sucesso');
  return new OAuth2Client(CLIENT_ID);
}

export default async function authRoutes(app: FastifyInstance) {

  // Rota para forçar criação das tabelas (APENAS PARA DESENVOLVIMENTO/EMERGÊNCIA)
app.post("/setup-database", async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    // Verificar se é ambiente de desenvolvimento ou tem senha de admin
    const { secret } = req.body as any;
    const validSecret = process.env.ADMIN_SECRET || 'dev-secret-123';
    
    if (secret !== validSecret && process.env.NODE_ENV === 'production') {
      return reply.status(403).send({
        success: false,
        message: "Acesso negado"
      });
    }
    
    console.log('🛠️  Executando setup do banco via API...');
    
    const { execSync } = require('child_process');
    
    // Executar db push
    execSync('npx prisma db push --accept-data-loss', { 
      stdio: 'pipe',
      encoding: 'utf8'
    });
    
    return reply.send({
      success: true,
      message: "Banco de dados configurado via API",
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('❌ Erro no setup via API:', error);
    return reply.status(500).send({
      success: false,
      message: error.message,
      output: error.stdout || error.stderr
    });
  }
});
  // Atualize a rota /google no backend
app.post("/google", async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    console.log("=== 🔐 INÍCIO AUTENTICAÇÃO GOOGLE ===");
    
    // 1. EXTRAIR O TOKEN
    const body = req.body as any;
    console.log("📦 Body recebido. Campos:", Object.keys(body));
    
    const token = body.token || body.credential || body.tokenId || body.id_token;
    console.log("🔑 Token extraído:", token ? "EXISTE" : "NÃO EXISTE");
    
    if (!token) {
      console.error("❌ Token não encontrado no request");
      return reply.status(400).send({ 
        success: false,
        message: "Token não fornecido",
        hint: "Envie como: { token: 'seu_token_aqui' }",
        receivedFields: Object.keys(body)
      });
    }
    
    console.log("📏 Comprimento do token:", token.length);
    console.log("🔤 Primeiros 30 chars:", token.substring(0, 30) + "...");
    
    // 2. VERIFICAR/CONFIGURAR CLIENTE GOOGLE
    if (!googleOAuthClient) {
      console.log("🔄 Criando cliente OAuth2...");
      const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
      
      if (!CLIENT_ID) {
        console.error("❌ GOOGLE_CLIENT_ID não definido no .env");
        return reply.status(500).send({ 
          success: false,
          message: "Configuração do servidor incompleta"
        });
      }
      
      console.log("✅ Client ID encontrado:", CLIENT_ID.substring(0, 30) + "...");
      googleOAuthClient = new OAuth2Client(CLIENT_ID);
      console.log("✅ Cliente OAuth2 inicializado");
    }
    
    // 3. VERIFICAR TOKEN COM GOOGLE
    console.log("🔍 Iniciando verificação do token...");
    console.log("🎯 Audience (Client ID):", process.env.GOOGLE_CLIENT_ID);
    
    let ticket;
    try {
      ticket = await googleOAuthClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID
      });
      console.log("✅ Token verificado com sucesso pelo Google");
    } catch (googleError: any) {
      console.error("❌ ERRO NA VERIFICAÇÃO DO TOKEN:");
      console.error("   Mensagem:", googleError.message);
      console.error("   Tipo:", googleError.constructor.name);
      
      // Erros comuns do Google
      if (googleError.message.includes('Wrong number of segments')) {
        console.error("   ❌ Token malformado (formato JWT inválido)");
      } else if (googleError.message.includes('Token used too late')) {
        console.error("   ❌ Token expirado");
      } else if (googleError.message.includes('Invalid token signature')) {
        console.error("   ❌ Assinatura inválida");
      } else if (googleError.message.includes('Audience mismatch')) {
        console.error("   ❌ Client ID incorreto");
      }
      
      return reply.status(400).send({ 
        success: false,
        message: "Token Google inválido",
        error: googleError.message,
        hint: "Verifique: 1) Token correto 2) Client ID correto 3) Token não expirado"
      });
    }
    
    // 4. EXTRAIR DADOS DO PAYLOAD
    const payload = ticket.getPayload();
    
    if (!payload) {
      console.error("❌ Payload do token vazio");
      return reply.status(400).send({ 
        success: false,
        message: "Token Google sem dados"
      });
    }
    
    if (!payload.email) {
      console.error("❌ Token não contém email");
      return reply.status(400).send({ 
        success: false,
        message: "Token Google sem email"
      });
    }
    
    console.log("✅ Dados extraídos do token:");
    console.log("   📧 Email:", payload.email);
    console.log("   👤 Nome:", payload.name || "Não informado");
    console.log("   🆔 Google ID:", payload.sub);
    console.log("   ✅ Email verificado:", payload.email_verified);
    console.log("   🖼️  Foto:", payload.picture || "Não tem");
    
    // 5. VERIFICAR/CRIAR USUÁRIO NO BANCO
    console.log("🔍 Buscando usuário no banco...");
    let user = await prisma.usuario.findUnique({
      where: { email: payload.email },
    });
    
    if (!user) {
      console.log("👤 Criando novo usuário...");
      
      // Preparar dados para criação
      const userData: any = {
        nome: payload.name || "Usuário Google",
        email: payload.email,
        BI: `GOOGLE_${payload.sub}`,
        tipo: "ADMIN",
        telefone:"",
        senhaHash:""
      };
      
      // Adicionar googleId se a coluna existir
      try {
        // Verifica se o modelo Prisma tem campo googleId
        userData.googleId = payload.sub;
      } catch (error) {
        console.log("ℹ️  Coluna googleId não disponível");
      }
      
      user = await prisma.usuario.create({
        data: userData,
      });
      
      console.log("✅ Usuário criado:", user.nome, "(ID:", user.id + ")");
    } else {
      console.log("✅ Usuário existente:", user.nome, "(ID:", user.id + ")");
      
      // Atualizar googleId se necessário
      if (user.googleId !== payload.sub) {
        console.log("🔄 Atualizando googleId...");
        await prisma.usuario.update({
          where: { id: user.id },
          data: { googleId: payload.sub }
        }).catch(err => {
          console.log("ℹ️  Não foi possível atualizar googleId:", err.message);
        });
      }
    }
    
    // 6. GERAR JWT
    console.log("🔑 Gerando token JWT...");
    const jwtToken = app.jwt.sign({
      id: user.id,
      email: user.email,
      tipo: user.tipo,
    }, {
      expiresIn: "7d"
    });
    
    console.log("✅ Token JWT gerado");
    console.log("🎯 tipo do usuário:", user.tipo);
    
    // 7. ENVIAR RESPOSTA
    console.log("📤 Enviando resposta ao frontend...");
    reply.send({
      success: true,
      message: "Login com Google realizado com sucesso",
      token: jwtToken,
      user: {
        id_usuario: user.id,
        nome: user.nome,
        email: user.email,
        tipo: user.tipo,
        googleId: payload.sub
      }
    });
    
    console.log("=== ✅ AUTENTICAÇÃO GOOGLE CONCLUÍDA ===");
    
  } catch (error: any) {
    console.error("❌ ERRO CRÍTICO NO LOGIN COM GOOGLE:");
    console.error("   Mensagem:", error.message);
    console.error("   Stack:", error.stack);
    console.error("   Tipo:", error.constructor.name);
    
    // Erros específicos do Prisma
    if (error.code === 'P2002') {
      console.error("   ❌ Erro de duplicidade no banco");
      return reply.status(400).send({ 
        success: false,
        message: "Email já cadastrado no sistema"
      });
    }
    
    // Erro geral
    reply.status(500).send({ 
      success: false,
      message: "Erro interno no servidor",
      error: error.message
    });
  }
});



  // Rota de registro (sem senha, já que o modelo não tem)
  app.post("/register", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { nome, email, tipo, telefone, senhaHash } = req.body as any;
      const {id} = req.params as any;
      // Verificar se o usuário já existe pelo email
      const existingUserByEmail = await prisma.usuario.findUnique({
        where: { email },
      });

      if (existingUserByEmail) {
        return reply.status(400).send({ message: "Email já está em uso" });
      }

      // Verificar se o BI já existe
      // const existingUserByBI = await prisma.usuario.findUnique({
      //   where: { BI },
      // });

      // if (existingUserByBI) {
      //   return reply.status(400).send({ message: "BI já está em uso" });
      // }

      // Criar usuário sem senha
      const user = await prisma.usuario.create({
        data: {
          nome,
          email,
          tipo: "CLIENTE",
          telefone,
          senhaHash,
          id: id
        },
      });

      reply.status(201).send({
        message: "Usuário registrado com sucesso",
        user: {
          id_usuario: user.id,
          nome: user.nome,
          email: user.email,
        }
      });
    } catch (error) {
      console.error("Erro no registro:", error);
      reply.status(500).send({ message: "Erro ao registrar usuário" });
    }
  });

  app.post("/forgot-password", async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { email } = req.body as any;
    
    const user = await prisma.usuario.findUnique({
      where: { email },
    });
    
    if (user) {
      const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiry = new Date(Date.now() + 3600_000);
      
      await prisma.usuario.update({
        where: { email },
        data: { resetToken: resetCode, resetTokenExpiry: expiry }
      });
      
      await sendResetCodeEmail(email, resetCode);
    }
    
    reply.code(200).send({ 
      success: true, // <-- IMPORTANTE: Adicionar esta linha
      message: "Se o email existir, um código de redefinição foi enviado." 
    });
    
  } catch (error) {
    console.error("Erro ao processar esqueci minha senha:", error);
    reply.status(500).send({ 
      success: false, // <-- IMPORTANTE
      message: "Erro ao processar solicitação" 
    });
  }
});

  app.post("/reset-password", async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { code, password } = req.body as any;
    
    console.log('\n🔐 SOLICITAÇÃO DE RESET DE SENHA');
    console.log(`📋 Código: ${code}`);
    
    const user = await prisma.usuario.findFirst({
      where: { resetToken: code }
    });

    if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      return reply.status(400).send({ 
        success: false, // <-- IMPORTANTE
        message: "Código inválido ou expirado." 
      });
    }

    const hashedPassword = await hashPassword(password);
    
    const isUpdated = await prisma.usuario.update({
      where: { id: user.id },
      data: {
        senhaHash: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null
      }
    });

    console.log('✅ Senha atualizada com sucesso para:', user.email);
    
    return reply.status(200).send({ 
      success: true, // <-- IMPORTANTE: Adicionar esta linha
      message: "Senha redefinida com sucesso." 
    });
    
  } catch (error: any) {
    console.error("❌ Erro ao redefinir senha:", error);
    reply.status(500).send({ 
      success: false, // <-- IMPORTANTE
      message: "Erro interno ao redefinir senha.",
      error: error.message 
    });
  }
});


 // Rota de login CORRETA
app.post("/login", async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { email, password } = req.body as any;

    console.log("📧 Tentando login para:", email);
    console.log("🔐 Senha fornecida:", password ? "SIM" : "NÃO");

    // 1. Buscar usuário APENAS pelo email
    const user = await prisma.usuario.findUnique({
      where: { email },
    });

    console.log("🔍 Resultado da busca:", user ? "ENCONTRADO" : "NÃO ENCONTRADO");

    // 2. Verificar se usuário existe
    if (!user) {
      console.log("❌ Usuário não encontrado:", email);
      return reply.status(401).send({
        success: false,
        message: "Usuário não encontrado",
        suggestion: "Verifique o email informado"
      });
    }

    console.log("✅ Usuário encontrado:", user.nome);
    console.log("🔐 Usuário tem senhaHash?", user.senhaHash ? "SIM" : "NÃO");

    // 3. VERIFICAR SE TEM SENHA CADASTRADA
    if (!user.senhaHash) {
      console.log("⚠️  Usuário não tem senha cadastrada");
      return reply.status(401).send({
        success: false,
        message: "Conta não possui senha cadastrada",
        suggestion: "Use Google Login ou recupere senha"
      });
    }

    // 4. VERIFICAR SE SENHA FOI FORNECIDA
    if (!password) {
      console.log("❌ Senha não fornecida");
      return reply.status(400).send({
        success: false,
        message: "Senha é obrigatória"
      });
    }

    // 5. VERIFICAR A SENHA (usando bcrypt)
    console.log("🔍 Verificando senha...");
    
    // Importar função
    const { verifyPassword } = require("../../utils/hash");
    
    try {
      // CORREÇÃO: Passar senha E hash
      const passwordValid = await verifyPassword(password, user.senhaHash);
      
      if (!passwordValid) {
        console.log("❌ Senha incorreta para:", email);
        return reply.status(401).send({
          success: false,
          message: "Senha incorreta"
        });
      }
      
      console.log("✅ Senha válida!");
    } catch (hashError: any) {
      console.error("❌ Erro ao verificar senha:", hashError);
      return reply.status(500).send({
        success: false,
        message: "Erro ao verificar credenciais"
      });
    }

    // 6. Gerar token JWT
    const token = app.jwt.sign({
      id: user.id,
      email: user.email,
      tipo: user.tipo
    }, {
      expiresIn: "7d"
    });

    console.log("✅ Login bem-sucedido para:", user.email);

    reply.send({
      success: true,
      message: "Login realizado com sucesso",
      token,
      user: {
        id_usuario: user.id,
        nome: user.nome,
        email: user.email,
        tipo: user.tipo,
        role: user.tipo === "ADMIN" ? "ADMIN" : "CLIENTE"
      }
    });
  } catch (error: any) {
    console.error("❌ Erro no login:", error);
    reply.status(500).send({ 
      success: false,
      message: "Erro ao realizar login",
      error: error.message 
    });
  }
});

  // Função de autenticação
  const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.status(401).send({ message: "Token inválido ou expirado" });
    }
  };

  // Rota para verificar token
  app.get("/me", { onRequest: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const userPayload = req.user as UserPayload;

      const user = await prisma.usuario.findUnique({
        where: { id: String(userPayload.id) },
        select: {
          id: true,
          nome: true,
          email: true,
          tipo: true,
          _count: {
            select: {
              avaliacao:true
            }
          },
          pedido: {
            select: {
              id: true,
              desconto: true,
              frete: true,
              criadoEm: true
            },
            take: 10,
            orderBy: {
              criadoEm: 'desc'
            }
          },
          devolucao: {
            select: {
              id: true,
              aprovadoEm: true,
              atualizadoEm: true,
              criadoEm: true
            },
            take: 10,
            orderBy: {
              criadoEm: 'desc'
            }
          }
        }
      });

      if (!user) {
        return reply.status(404).send({ message: "Usuário não encontrado" });
      }

      reply.send({ user });
    } catch (error) {
      console.error("Erro ao buscar usuário:", error);
      reply.status(500).send({ message: "Erro ao buscar informações do usuário" });
    }
  });

  // Rota para logout (apenas invalidar token no frontend)
  app.post("/logout", { onRequest: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    reply.send({ message: "Logout realizado com sucesso" });
  });

  // Rota para renovar token
  app.post("/refresh", { onRequest: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const userPayload = req.user as UserPayload;

      const user = await prisma.usuario.findUnique({
        where: { id: String(userPayload.id)  },
        select: {
          id: true,
          nome: true,
          email: true,
          tipo: true
        }
      });

      if (!user) {
        return reply.status(404).send({ message: "Usuário não encontrado" });
      }

      // Gerar novo token
      const newToken = app.jwt.sign({
        id: user.id,
        email: user.email,
        tipo: user.tipo
      });

      reply.send({
        message: "Token renovado com sucesso",
        token: newToken,
        user
      });
    } catch (error) {
      console.error("Erro ao renovar token:", error);
      reply.status(500).send({ message: "Erro ao renovar token" });
    }
  });
}