// src/app.ts
import Fastify from "fastify";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import * as dotenv from 'dotenv';
import fastifyStatic from "@fastify/static"

import authRoutes from "./modules/auth/auth.routes";
import usuarioRoutes from "./modules/usuarios/usuarios.routes";
import vendasRoutes from "./modules/vendas/vendas.routes";
import produtosRoutes from "./modules/produtos/produtos.routes";
import pedidosRoutes from "./modules/pedidos/pedidos.routes";
import categoriasRoutes from "./modules/categorias/categorias.routes";
import path from "path";

dotenv.config();

if (!process.env.JWT_SECRET) {
    console.error("❌ ERRO: JWT_SECRET não definido no .env");
    process.exit(1);
}

// Configurar logger
const loggerConfig = process.env.NODE_ENV === 'production'
    ? true
    : {
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
    // Aumentar limites do body
    bodyLimit: 10 * 1024 * 1024, // 10MB
    // Aumentar tempo de conexão
    connectionTimeout: 120000, // 2 minutos
});

// ============================================
// CORS MANUAL - SOLUÇÃO DEFINITIVA
// ============================================

// Lista de origens permitidas
const allowedOrigins = [
    'https://sufficius-ecommerce.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:8080',
    'https://sufficius-ecommerce-back.onrender.com'
];

// Hook para todas as requisições
app.addHook('onRequest', (request, reply, done) => {
    const origin = request.headers.origin;

    // Se for preflight (OPTIONS), responder imediatamente
    if (request.method === 'OPTIONS') {
        // Permitir qualquer origem durante o desenvolvimento
        if (origin && allowedOrigins.includes(origin)) {
            reply.header('Access-Control-Allow-Origin', origin);
            reply.header('Access-Control-Allow-Credentials', 'true');
        } else {
            // Em produção, seja mais restritivo
            if (process.env.NODE_ENV === 'development') {
                reply.header('Access-Control-Allow-Origin', origin || '*');
            } else if (origin) {
                reply.header('Access-Control-Allow-Origin', origin);
            }
        }

        reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        reply.header('Access-Control-Allow-Headers',
            'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Access-Token, X-API-Key, Content-Type, Authorization');
        reply.header('Access-Control-Allow-Credentials', 'true');
        reply.header('Access-Control-Max-Age', '86400'); // 24 horas

        reply.status(204).send();
        return;
    }

    // Para requisições normais
    if (origin && allowedOrigins.includes(origin)) {
        reply.header('Access-Control-Allow-Origin', origin);
        reply.header('Access-Control-Allow-Credentials', 'true');
    } else if (origin && process.env.NODE_ENV === 'development') {
        // Permite qualquer origem em desenvolvimento
        reply.header('Access-Control-Allow-Origin', origin);
    } else if (origin) {
        console.log(`🚫 Origem bloqueada: ${origin}`);
        // Não adiciona o header CORS para origens não permitidas
    }

    done();
});

// Hook para respostas (garantir headers em todas as respostas)
app.addHook('onSend', (request, reply, payload, done) => {
    const origin = request.headers.origin;

    // Garantir que os headers CORS estão presentes em todas as respostas
    if (origin && allowedOrigins.includes(origin)) {
        reply.header('Access-Control-Allow-Origin', origin);
        reply.header('Access-Control-Allow-Credentials', 'true');
    } else if (origin && process.env.NODE_ENV === 'development') {
        reply.header('Access-Control-Allow-Origin', origin);
    }

    // Headers adicionais de segurança
    reply.header('Access-Control-Expose-Headers', 'Content-Length, X-Total-Count, Authorization');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-XSS-Protection', '1; mode=block');

    done();
});

// ============================================
// FIM DO CORS MANUAL
// ============================================

// Registrar plugins
app.register(jwt, {
    secret: process.env.JWT_SECRET
});

// CONFIGURAÇÃO MULTIPART OTIMIZADA PARA UPLOAD DE IMAGENS
app.register(multipart, {
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 1,
        fieldSize: 10 * 1024 * 1024, // 10MB para campos
        headerPairs: 2000 // Aumentar limite de headers
    },
    attachFieldsToBody: true,
    sharedSchemaId: '#mySharedSchema',
    // Callback para monitorar upload de arquivos
    onFile: (part) => {
        console.log(`📁 Processando arquivo: ${part.filename} (${part.mimetype})`);
    }
});

// // Configurar content type parser para multipart
// app.addContentTypeParser('multipart/form-data', { 
//     parseAs: 'buffer',
//     bodyLimit: 10 * 1024 * 1024 // 10MB
// }, (req, body, done) => {
//     done(null, body);
// });

app.register(fastifyStatic, {
    root: path.join(process.cwd(), 'uploads'),
    prefix: '/uploads/',
    decorateReply: false,

    serve:true,
    preCompressed:false,

    setHeaders: (res, path) => {
        res.setHeader('access-control-allow-origin', '*');
        res.setHeader('cache-control', 'public, max=86400');
        res.setHeader('cross-origin-resource-policy', 'cross-origin');
    },
    list: process.env.NODE_ENV === 'development',
    redirect: false
});

// Swagger/OpenAPI
app.register(swagger, {
    swagger: {
        info: {
            title: 'Sufficius API',
            description: 'API para a Sufficius E-commerce',
            version: process.env.API_VERSION || '1.0.0'
        },
        host: process.env.NODE_ENV === 'production'
            ? 'sufficius-ecommerce-back.onrender.com'
            : `localhost:${process.env.PORT || 3000}`,
        schemes: process.env.NODE_ENV === 'production' ? ['https'] : ['http', 'https'],
        consumes: ['application/json', 'multipart/form-data'], // Adicionado multipart
        produces: ['application/json'],
        securityDefinitions: {
            bearerAuth: {
                type: 'apiKey',
                name: 'Authorization',
                in: 'header',
                description: 'Insira o token JWT no formato: Bearer {token}'
            }
        }
    }
});

app.register(swaggerUI, {
    routePrefix: "/docs",
    uiConfig: {
        docExpansion: 'list',
        deepLinking: true
    },
    staticCSP: true,
    transformSpecification: (swaggerObject) => {
        return swaggerObject;
    }
});

// Registrar rotas principais
app.register(authRoutes, { prefix: `/auth` });
app.register(usuarioRoutes, { prefix: `/usuarios` });
app.register(vendasRoutes, { prefix: `/vendas` });
app.register(produtosRoutes, { prefix: '/produtos' });
app.register(pedidosRoutes, { prefix: `/pedidos` });
app.register(categoriasRoutes, { prefix: `/categorias` });

// Rotas básicas
app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.API_VERSION || '1.0.0',
    service: 'Sufficius API',
    corsConfigured: true
}));

app.get('/', async () => ({
    message: 'Sufficius API está rodando!',
    version: process.env.API_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    docs: '/docs',
    health: '/health',
    cors: 'CORS manual configurado'
}));

app.get('/uploads/test.txt', async (request, reply) => {
  return reply.send('Teste de uploads funcionando!');
});

// Error handler global
app.setErrorHandler(function (error, request, reply) {
    console.error('🔥 Error handler:', error);

    // Adicionar headers CORS mesmo em erros
    const origin = request.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
        reply.header('Access-Control-Allow-Origin', origin);
        reply.header('Access-Control-Allow-Credentials', 'true');
    }

    if (error.validation) {
        return reply.status(400).send({
            success: false,
            error: 'Erro de validação',
            details: error.validation
        });
    }

    // Erro específico de timeout
    if (error.code === 'FST_ERR_CTP_INVALID_CONTENT_LENGTH' || 
        error.message?.includes('timeout')) {
        return reply.status(408).send({
            success: false,
            error: 'Tempo limite excedido',
            message: 'O upload está demorando muito. Tente com uma imagem menor ou verifique sua conexão.'
        });
    }

    return reply.status(500).send({
        success: false,
        error: 'Erro interno do servidor',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
});

// Not found handler
app.setNotFoundHandler(function (request, reply) {
    // Adicionar headers CORS mesmo em 404
    const origin = request.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
        reply.header('Access-Control-Allow-Origin', origin);
        reply.header('Access-Control-Allow-Credentials', 'true');
    }

    reply.status(404).send({
        success: false,
        error: 'Rota não encontrada',
        path: request.url,
    });
});

// Hook para debug de requisições multipart
app.addHook('preValidation', async (request, reply) => {
    const contentType = request.headers['content-type'] || '';
    
    if (contentType.includes('multipart/form-data')) {
        const contentLength = request.headers['content-length'];
        console.log(`🔄 Recebendo multipart: ${request.method} ${request.url}`);
        if (contentLength) {
            const sizeMB = (parseInt(contentLength) / (1024 * 1024)).toFixed(2);
            console.log(`   📊 Tamanho: ${sizeMB}MB`);
        }
    }
});

export default app;