// src/app.ts FIXED - com autenticação corrigida
import Fastify from "fastify";
import jwt from "@fastify/jwt";
import multipart, { MultipartFile } from "@fastify/multipart";
import * as dotenv from 'dotenv';

import authRoutes from "./modules/auth/auth.routes";
import usuarioRoutes from "./modules/usuarios/usuarios.routes";
import vendasRoutes from "./modules/vendas/vendas.routes";
import produtosRoutes from "./modules/produtos/produtos.routes";
import pedidosRoutes from "./modules/pedidos/pedidos.routes";
import categoriasRoutes from "./modules/categorias/categorias.routes";
import pagamentosRoutes from "./modules/pagamentos/pagamentos.routes";
import enderecosRoutes from "./modules/enderecos/enderecos.routes";
import avaliacoesRoutes from "./modules/avaliacoes/avaliacoes.routes";
import carrinhoRoutes from "./modules/carrinho/carrinho.routes";
import itemcarrinhoRoutes from "./modules/itemcarrinho/itemcarrinho.route";

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
    connectionTimeout: 60000,
    keepAliveTimeout: 60000,
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

// Multipart (simplificado)
app.register(multipart, {
    limits: {
        fileSize: 50 * 1024 * 1024,
        files: 5
    },
    attachFieldsToBody: false,
});

// Tipagem para o request com autenticação
declare module 'fastify' {
  interface FastifyRequest {
    usuario?: {
      id: string;
      email: string;
      tipo: string;
      fotoUrl?:string;
    };
  }
}

// Hook de autenticação
app.addHook('onRequest', async (request, reply) => {
  try {
    // Rotas públicas que não precisam de autenticação
    const publicRoutes = [
    {method: 'POST', path: '/usuarios/login'},
      {method: 'POST', path: '/auth/login'},
      {method: 'POST', path: '/auth/register'},
      {method: 'POST', path: '/auth/google'},
      {method: 'GET', path: '/health'},
      {method: 'GET', path: '/'},
      {method: 'GET', path: '/produtos'},
      {method: 'GET', path: '/pedidos'},
      {method: 'GET', path: '/produtos/:id'},
      {method: 'GET', path: '/debug'},
    ];
    
    // Verificar se a rota atual é pública
    const isPublicRoute = publicRoutes.some(route => 
      request.url === route.path && request.method === route.method
    );
    
    if (isPublicRoute) {
      return;
    }

    
    const authHeader = request.headers.authorization;
    
    if (!authHeader) {
      reply.status(401).send({
        success: false,
        error: 'Token não fornecido'
      });
      return;
    }

    if (!authHeader.startsWith('Bearer ')) {
      reply.status(401).send({
        success: false,
        error: 'Formato do token inválido. Use "Bearer <token>"'
      });
      return;
    }

    const token = authHeader.replace('Bearer ', '');

     if (!token) {
            reply.code(401).send({
                success: false,
                message: 'Token inválido'
            });
            return;
        }
    
      try {
      // Verificar token JWT (jwtVerify lê o header Authorization automaticamente)
      const decoded = await request.jwtVerify<{ id: string; email: string; tipo: string, fotoUrl: string }>(token as any);
      
      // Adicionar informações do usuário ao request
      request.usuario = {
        id: decoded.id,
        email: decoded.email,
        tipo: decoded.tipo,
        fotoUrl: decoded.fotoUrl
      };

      console.log('✅ Usuário autenticado:', {
        id: decoded.id,
        email: decoded.email,
        fotoUrl:decoded.fotoUrl
        // tipo: decoded.tipo
      });

    } catch (jwtError: any) {
      reply.status(401).send({
        success: false,
        error: 'Token inválido ou expirado'
      });
    }

  } catch (error: any) {
    reply.status(500).send({
      success: false,
      error: 'Erro interno na autenticação'
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

    const token = authHeader.substring(7);    
    try {
      const decoded = await request.jwtVerify<{ id: string; email: string; tipo: string; fotoUrl:string }>();
      
      return reply.send({
        success: true,
        decodedToken: decoded,
        requestUsuario: request.usuario,
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
app.register(avaliacoesRoutes, { prefix: `/avaliacoes` });
app.register(carrinhoRoutes, { prefix: `/carrinho` });
app.register(itemcarrinhoRoutes, {prefix: `/itemcarrinho`})


// Error handler simplificado
app.setErrorHandler(function (error: any, request, reply) {
    console.error('❌ Error:', error);
    return reply.status(500).send({
        success: false,
        error: 'Erro interno do servidor',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Contate o administrador'
    });
});

export default app;