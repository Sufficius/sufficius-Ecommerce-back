// src/app.ts
import Fastify from "fastify";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import * as dotenv from 'dotenv';

import authRoutes from "./modules/auth/auth.routes";
import usuarioRoutes from "./modules/usuarios/usuarios.routes";
import servicoRoutes from "./services/service.routes";
import vendasRoutes from "./modules/vendas/vendas.routes";
import produtosRoutes from "./modules/produtos/produtos.routes";
import pedidosRoutes from "./modules/pedidos/pedidos.routes";
import categoriasRoutes from "./modules/categorias/categorias.routes";

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
    logger: loggerConfig
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

console.log('🌐 CORS Origins configurados:', allowedOrigins);

// Hook para todas as requisições
app.addHook('onRequest', (request, reply, done) => {
    const origin = request.headers.origin;
    
    // Log para debug
    console.log(`🌐 ${request.method} ${request.url} | Origin: ${origin || 'none'}`);
    
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

// Hook para debug das rotas
app.addHook('onRoute', (routeOptions) => {
    // console.log(`✅ Rota registrada: ${routeOptions.method} ${routeOptions.url}`);
});

// Registrar plugins
app.register(jwt, {
    secret: process.env.JWT_SECRET
});

app.register(multipart, {
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 5
    }
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
        consumes: ['application/json'],
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

// Comente se não for necessário ou ajuste o prefixo
// app.register(servicoRoutes, { prefix: `/servicos` });

// Função auxiliar para listar rotas
const listRoutes = () => {
    console.log('\n📋 TODAS AS ROTAS REGISTRADAS:');
    console.log('================================');

    // const routes = app.printRoutes();
    // console.log(routes);
    console.log('================================\n');
};

// Tratamento de erros não capturados
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

// Registrar rotas dinâmicas
const registerDynamicRoutes = async () => {
    const dynamicRoutes = [
        { path: './modules/avaliacoes/avaliacoes.routes', prefix: '/avaliacoes' },
        { path: './modules/enderecos/enderecos.routes', prefix: '/enderecos' },
        { path: './modules/carrinho/carrinho.routes', prefix: '/carrinho' },
        { path: './modules/pagamentos/pagamentos.routes', prefix: '/pagamentos' }
    ];

    for (const { path: routePath, prefix } of dynamicRoutes) {
        try {
            const module = await import(routePath);
            app.register(module.default, { prefix });
            console.log(`✅ Rotas de ${prefix} registradas`);
        } catch (error: any) {
            // Ignora erro se o arquivo não existir
            if (error.code !== 'MODULE_NOT_FOUND') {
                console.error(`❌ Erro ao importar rotas de ${prefix}:`, error.message);
            }
        }
    }
};

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

    return reply.status(500).send({
        success: false,
        error: 'Erro interno do servidor'
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
        availableRoutes: app.printRoutes().split('\n').slice(0, 10) // Mostra 10 primeiras rotas
    });
});


export default app;