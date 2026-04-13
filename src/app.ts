// src/app.ts FIXED - com autenticação corrigida
import Fastify from "fastify";
import jwt from "@fastify/jwt";
import multipart, { MultipartFile } from "@fastify/multipart";
import * as dotenv from 'dotenv';
import fastifyStatic from "@fastify/static";

import authRoutes from "./modules/auth/auth.routes";
import usuarioRoutes from "./modules/usuarios/usuarios.routes";
import vendasRoutes from "./modules/vendas/vendas.routes";
import produtosRoutes from "./modules/produtos/produtos.routes";
import pedidosRoutes from "./modules/pedidos/pedidos.routes";
import categoriasRoutes from "./modules/categorias/categorias.routes";
import pagamentosRoutes from "./modules/pagamentos/pagamentos.routes";
import enderecosRoutes from "./modules/enderecos/enderecos.routes";
// import avaliacoesRoutes from "./modules/avaliacoes/avaliacoes.routes";
import carrinhoRoutes from "./modules/carrinho/carrinho.routes";
import itemcarrinhoRoutes from "./modules/itemcarrinho/itemcarrinho.route";
import { join } from "path";
import uploadRoutes from "./modules/upload/upload";
import estoqueRoutes from "./modules/estoque/estoque.routes";
import { prisma } from "./lib/prisma";

dotenv.config();

if (!process.env.JWT_SECRET) {
  console.error("❌ ERRO: JWT_SECRET não definido no .env");
  process.exit(1);
}

const loggerConfig = process.env.NODE_ENV === 'production' ? true : {
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname'
    }
  }
};

const app = Fastify({
  logger: loggerConfig,
  bodyLimit: 20 * 1024 * 1024,
  connectionTimeout: 30000,
  keepAliveTimeout: 30000,
  maxParamLength: 500,
  disableRequestLogging: false,
});

// CORS MANUAL
const allowedOrigins = [
  'https://sufficius-ecommerce.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:8080',
  'https://sufficius-ecommerce-back.onrender.com'
];

app.addHook('onRequest', (request, reply, done) => {
  const origin = request.headers.origin;
  if (request.method === 'OPTIONS') {
    if (origin && allowedOrigins.includes(origin)) {
      reply.header('Access-Control-Allow-Origin', origin);
      reply.header('Access-Control-Allow-Credentials', 'true');
    } else if (process.env.NODE_ENV === 'development') {
      reply.header('Access-Control-Allow-Origin', origin || '*');
    }
    reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Access-Token, X-API-Key, Content-Type, Authorization');
    reply.header('Access-Control-Allow-Credentials', 'true');
    reply.header('Access-Control-Max-Age', '86400');
    reply.status(204).send();
    return;
  }
  if (origin && allowedOrigins.includes(origin)) {
    reply.header('Access-Control-Allow-Origin', origin);
    reply.header('Access-Control-Allow-Credentials', 'true');
  } else if (origin && process.env.NODE_ENV === 'development') {
    reply.header('Access-Control-Allow-Origin', origin);
  }
  done();
});

app.addHook('onSend', (request, reply, payload, done) => {
  const origin = request.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    reply.header('Access-Control-Allow-Origin', origin);
    reply.header('Access-Control-Allow-Credentials', 'true');
  } else if (origin && process.env.NODE_ENV === 'development') {
    reply.header('Access-Control-Allow-Origin', origin);
  }
  reply.header('Access-Control-Expose-Headers', 'Content-Length, X-Total-Count, Authorization');
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('X-XSS-Protection', '1; mode=block');
  done();
});

// JWT
app.register(jwt, {
  secret: process.env.JWT_SECRET,
  sign: { expiresIn: '7d' }
});

app.register(fastifyStatic, {
  root: join(__dirname, '../uploads'),
  prefix: '/uploads/', // Isso fará com que arquivos em /public sejam servidos na raiz
  decorateReply: false
});

// Multipart (simplificado)
app.register(multipart, {
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 5
  },
  // attachFieldsToBody: true,
});

// Tipagem para o request com autenticação
declare module 'fastify' {
  interface FastifyRequest {
    users?: {
      id: string;
      email: string;
      tipo: string;
      fotoUrl?: string;
    };
  }
}

// Hook de autenticação CORRIGIDO
app.addHook('onRequest', async (request, reply) => {
  try {
    if (request.method === 'HEAD' || request.url === '/' || request.url === '/health') {
      return;
    }

    // Rotas públicas que não precisam de autenticação
    const publicRoutes = [
      { method: 'POST', path: '/usuarios/login' },
      { method: 'POST', path: '/auth/login' },
      { method: 'POST', path: '/auth/register' },
      { method: 'POST', path: '/auth/google' },
      { method: 'GET', path: '/health' },
      { method: 'GET', path: '/' },
      { method: 'HEAD', path: '/' },
      { method: 'GET', path: '/produtos' },
      { method: 'GET', path: '/categorias' },
      { method: 'GET', path: '/produtos/get' },
      { method: 'GET', path: '/pedidos' },
      { method: 'GET', path: '/produtos/:id' },
      { method: 'GET', path: '/debug' },
      { method: 'GET', path: '/debug/auth' },
      { method: 'GET', path: '/carrinho/count-items-on-card' },
      { method: 'POST', path: '/carrinho/item' },
      { method: 'GET', path: '/carrinho' },
      { method: 'DELETE', path: '/carrinho/item' },
      { method: 'PUT', path: '/carrinho/item' },
    ];

    // Verificar se a rota atual é pública
    const isPublicRoute = publicRoutes.some(route =>
      request.method === route.method && request.url.startsWith(route.path.replace(':id', ''))
    );

    // 🔍 LOG DE DEBUG
    console.log('🔍 [AUTH HOOK]', {
      method: request.method,
      url: request.url,
      isPublic: isPublicRoute,
      hasAuthHeader: !!request.headers.authorization,
      origin: request.headers.origin
    });

    if (isPublicRoute) {
      console.log('✅ Rota pública, ignorando autenticação:', request.url);
      return;
    }

    // Para rotas do carrinho, permitir mesmo sem token? (retorna 0 itens)
    if (request.url.startsWith('/carrinho/')) {
      // Se for GET count-items-on-card e não tem token, retorna 0
      if (request.url === '/carrinho/count-items-on-card' && request.method === 'GET') {
        const authHeader = request.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          console.log('⚠️ Sem token para count-items-on-card, retornando 0');
          // Em vez de retornar 401, retorna 0 itens
          reply.status(200).send({ totalItens: 0 });
          return; // Importante: para a execução
        }
      }
    }

    const authHeader = request.headers.authorization;

    if (!authHeader) {
      console.log('❌ Token não fornecido para:', request.method, request.url);
      reply.status(401).send({
        success: false,
        message: 'Token não fornecido'
      });
      return;
    }

    if (!authHeader.startsWith('Bearer ')) {
      console.log('❌ Formato token inválido:', request.method, request.url);
      reply.status(401).send({
        success: false,
        message: 'Formato do token inválido. Use "Bearer <token>"'
      });
      return;
    }

    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      console.log('❌ Token vazio');
      reply.code(401).send({
        success: false,
        message: 'Token inválido'
      });
      return;
    }

    try {
      // Verificar token JWT
      const decoded = await request.jwtVerify<{ id: string; email: string; tipo: string, fotoUrl?: string }>();

      // Adicionar informações do usuário ao request
      request.user = {
        id: decoded.id,
        email: decoded.email,
        tipo: decoded.tipo,
        fotoUrl: decoded.fotoUrl
      };

      console.log('✅ Usuário autenticado:', {
        id: decoded.id,
        email: decoded.email,
        url: request.url
      });

    } catch (jwtError: any) {
      console.log('❌ Token inválido/expirado:', jwtError.message);
      reply.status(401).send({
        success: false,
        message: 'Token inválido ou expirado'
      });
      return;
    }

  } catch (error: any) {
    console.error('❌ Erro na autenticação:', error);
    reply.status(500).send({
      success: false,
      message: 'Erro interno na autenticação'
    });
  }
});

// Rotas básicas
app.get('/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  environment: process.env.NODE_ENV || 'development',
  service: 'Sufficius API'
}));

app.get('/', async () => ({
  message: 'Sufficius API está rodando!',
  endpoints: {
    auth: '/auth',
    produtos: '/produtos',
    pedidos: '/pedidos',
    carrinho: '/carrinho',
    enderecos: '/enderecos'
  }
}));

// Rota de debug para verificar autenticação
app.get('/debug/auth', async (request, reply) => {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.send({
        success: false,
        error: 'Token não fornecido',
        headers: request.headers
      });
    }

    try {
      const decoded = await request.jwtVerify<{ id: string; email: string; tipo: string; fotoUrl: string }>();

      return reply.send({
        success: true,
        decodedToken: decoded,
        requestUsuario: request.user,
        headers: {
          authorization: request.headers.authorization?.substring(0, 50) + '...',
          origin: request.headers.origin
        }
      });
    } catch (jwtError) {
      const details = jwtError instanceof Error ? jwtError.message : String(jwtError);
      return reply.send({
        success: false,
        error: 'Token inválido',
        details
      });
    }

  } catch (error: any) {
    return reply.send({
      success: false,
      error: error.message
    });
  }
});

// Registrar rotas principais
app.register(authRoutes, { prefix: `/auth` });
app.register(usuarioRoutes, { prefix: `/usuarios` });
app.register(vendasRoutes, { prefix: `/vendas` });
app.register(produtosRoutes, { prefix: '/produtos' });
app.register(pedidosRoutes, { prefix: `/pedidos` });
app.register(categoriasRoutes, { prefix: `/categorias` });
app.register(pagamentosRoutes, { prefix: `/pagamentos` });
app.register(enderecosRoutes, { prefix: `/enderecos` });
app.register(estoqueRoutes, { prefix: `/estoque` });
app.register(carrinhoRoutes, { prefix: `/carrinho` });
app.register(itemcarrinhoRoutes, { prefix: `/itemcarrinho` });
app.register(uploadRoutes, { prefix: `/upload` });


// Error handler simplificado
app.setErrorHandler(function (error: any, request, reply) {
  console.error('❌ Error:', error);
  return reply.status(500).send({
    success: false,
    error: 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Contate o administrador'
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing server...')
  await app.close()
  await prisma.$disconnect()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing server...')
  await app.close()
  await prisma.$disconnect()
  process.exit(0)
})

export default app;