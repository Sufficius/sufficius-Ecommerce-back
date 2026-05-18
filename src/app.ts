import Fastify from "fastify";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
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
import carrinhoRoutes from "./modules/carrinho/carrinho.routes";
import itemcarrinhoRoutes from "./modules/itemcarrinho/itemcarrinho.route";
import { join } from "path";
import uploadRoutes from "./modules/upload/upload";
import estoqueRoutes from "./modules/estoque/estoque.routes";
import { prisma } from "./lib/prisma";
import notificationRoutes from "./modules/notifications/notification.routes";

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


const allowedOrigins = [
  'https://sufficius-ecommerce.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:8080',
];

app.register(jwt, {
  secret: process.env.JWT_SECRET,
  sign: { expiresIn: '7d' }
});

app.register(fastifyStatic, {
  root: join(__dirname, '../uploads'),
  prefix: '/uploads/',
  decorateReply: false
});

app.register(multipart, {
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 5
  },
});

declare module 'fastify' {
  interface FastifyRequest {
    usuario?: {
      id: string;
      email: string;
      tipo: string;
      fotoUrl?: string;
    };
  }
}


app.addHook('onRequest', async (request, reply) => {
  const origin = request.headers.origin;
  
  if (origin && allowedOrigins.includes(origin)) {
    reply.header('Access-Control-Allow-Origin', origin);
    reply.header('Access-Control-Allow-Credentials', 'true');
  } else if (process.env.NODE_ENV === 'development' && origin) {
    reply.header('Access-Control-Allow-Origin', origin);
  }
  if (request.method === 'OPTIONS') {
    reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Access-Token, X-API-Key');
    reply.header('Access-Control-Max-Age', '86400');
    reply.status(204).send();
    return; 
  }

  const publicRoutePatterns = [
    { method: 'POST', pattern: /^\/usuarios\/login$/ },
    { method: 'POST', pattern: /^\/auth\/login$/ },
    { method: 'POST', pattern: /^\/auth\/register$/ },
    { method: 'POST', pattern: /^\/auth\/google$/ },
    
    { method: 'GET', pattern: /^\/health$/ },
    { method: 'GET', pattern: /^\/$/ },
    { method: 'HEAD', pattern: /^\/$/ },
    { method: 'GET', pattern: /^\/debug\/auth$/ },
    
    { method: 'GET', pattern: /^\/produtos$/ },
    { method: 'GET', pattern: /^\/produtos\/get$/ },
    { method: 'GET', pattern: /^\/produtos\/[^/]+$/ }, 
    { method: 'GET', pattern: /^\/categorias$/ },
    { method: 'GET', pattern: /^\/pedidos$/ },
    
    { method: 'GET', pattern: /^\/carrinho\/count-items-on-card$/ },
    { method: 'GET', pattern: /^\/carrinho$/ },
    { method: 'DELETE', pattern: /^\/carrinho\/item\/[^/]+$/ },
    { method: 'PUT', pattern: /^\/carrinho\/item\/[^/]+$/ },
  ];

  const isPublicRoute = publicRoutePatterns.some(route => 
    request.method === route.method && route.pattern.test(request.url)
  );

  console.log('🔍 [AUTH HOOK]', {
    method: request.method,
    url: request.url,
    isPublic: isPublicRoute,
    hasAuthHeader: !!request.headers.authorization,
    origin: request.headers.origin
  });

 if (isPublicRoute) {
  console.log('✅ Rota pública:', request.url);
  
  // ⚡ Tenta extrair o token mesmo em rota pública
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.replace('Bearer ', '');
      const decoded = await request.jwtVerify<{ 
        id: string; 
        email: string; 
        tipo: string; 
        fotoUrl?: string 
      }>();
      
      request.user = {
        id: decoded.id,
        email: decoded.email,
        tipo: decoded.tipo,
        fotoUrl: decoded.fotoUrl
      };
      
      console.log('✅ Usuário opcional autenticado:', {
        id: decoded.id,
        email: decoded.email,
        url: request.url
      });
    } catch (jwtError) {
      // Token inválido/expirado, mas rota é pública - OK
      console.log('⚠️ Token opcional inválido:', request.url);
    }
  }
  
  return; // Continua para o handler
}

  const authHeader = request.headers.authorization;

  if (!authHeader) {
    console.log('❌ Token não fornecido para:', request.method, request.url);
    return reply.status(401).send({
      success: false,
      message: 'Token não fornecido'
    });
  }

  if (!authHeader.startsWith('Bearer ')) {
    console.log('❌ Formato token inválido:', request.method, request.url);
    return reply.status(401).send({
      success: false,
      message: 'Formato do token inválido. Use "Bearer <token>"'
    });
  }

  const token = authHeader.replace('Bearer ', '');

  if (!token) {
    console.log('❌ Token vazio');
    return reply.status(401).send({
      success: false,
      message: 'Token inválido'
    });
  }

  try {
    const decoded = await request.jwtVerify<{ 
      id: string; 
      email: string; 
      tipo: string; 
      fotoUrl?: string 
    }>();

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
    return reply.status(401).send({
      success: false,
      message: 'Token inválido ou expirado'
    });
  }
});

app.addHook('onSend', (request, reply, payload, done) => {
  const origin = request.headers.origin;
  
  if (origin && allowedOrigins.includes(origin)) {
    reply.header('Access-Control-Allow-Origin', origin);
    reply.header('Access-Control-Allow-Credentials', 'true');
  } else if (process.env.NODE_ENV === 'development' && origin) {
    reply.header('Access-Control-Allow-Origin', origin);
  }
  
  reply.header('Access-Control-Expose-Headers', 'Content-Length, X-Total-Count, Authorization');
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('X-XSS-Protection', '1; mode=block');
  
  done();
});


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
app.register(notificationRoutes, { prefix: `/notifications` });

app.setErrorHandler(function (error: any, request, reply) {
  console.error('❌ Error:', error);
  
  if (error.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
    return reply.status(401).send({
      success: false,
      message: 'Token não fornecido'
    });
  }
  
  return reply.status(500).send({
    success: false,
    error: 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Contate o administrador'
  });
});

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