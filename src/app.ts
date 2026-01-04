// src/app.ts
import Fastify from "fastify";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import * as dotenv from 'dotenv';
import cors from "@fastify/cors";

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

// Hook para debug das rotas
app.addHook('onRoute', (routeOptions) => {
    // console.log(`✅ Rota registrada: ${routeOptions.method} ${routeOptions.url}`);
});

// Configurar CORS
const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o: string) => o.trim())
    : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:8080', 'https://sufficius-ecommerce.vercel.app/'];

app.register(cors, {
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'X-Access-Token', 'X-API-Key']
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
        host: `localhost:${process.env.PORT || 3000}`,
        schemes: ['http', 'https'],
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

    const routes = app.printRoutes();
    console.log(routes);

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
    service: 'Sufficius API'
}));

app.get('/', async () => ({
    message: 'Sufficius API está rodando!',
    version: process.env.API_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    docs: '/docs',
    health: '/health'
}));

// Error handler global
app.setErrorHandler(function (error, request, reply) {
    console.error('🔥 Error handler:', error);

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
    reply.status(404).send({
        success: false,
        error: 'Rota não encontrada',
        path: request.url
    });
});

// Função para iniciar o servidor
const start = async () => {
    try {
        // Registrar rotas dinâmicas
        await registerDynamicRoutes();

        // Aguardar o servidor estar pronto
        await app.ready();

        // Listar rotas registradas
        listRoutes();

        // Iniciar servidor
        const port = parseInt(process.env.PORT || '3000');
        const host = process.env.HOST || '0.0.0.0';

        await app.listen({
            port,
            host
        });

        console.log(`🚀 Servidor rodando em http://${host}:${port}`);
        console.log(`📚 Documentação: http://${host}:${port}/docs`);
        console.log(`🏥 Health check: http://${host}:${port}/health`);
        console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);

    } catch (err) {
        console.error('❌ Erro ao iniciar servidor:', err);
        process.exit(1);
    }
};

// Iniciar servidor
// start();

export default app;