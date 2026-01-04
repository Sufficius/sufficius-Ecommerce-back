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

dotenv.config();

if (!process.env.JWT_SECRET) {
    console.error("❌ ERRO: JWT_SECRET não definido no .env");
    process.exit(1);
}

const app = Fastify({ 
    logger: {
        transport: {
            target: 'pino-pretty',
            options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname'
            }
        }
    } 
});

// Hook para debug das rotas
app.addHook('onRoute', (routeOptions) => {
    console.log(`✅ Rota registrada: ${routeOptions.method} ${routeOptions.url}`);
});

const corsOptions = {
    origin: process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(',').map((o: string) => o.trim())
        : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:8080'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'X-Access-Token', 'X-API-Key']
};

app.addHook('onRequest', (request, reply, done) => {
    const origin = request.headers.origin;
    if (origin) {
        const allowedOrigins = corsOptions.origin;
        if (allowedOrigins.includes("*") || allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
            reply.header('Access-Control-Allow-Origin', origin);
            reply.header('Access-Control-Allow-Methods', corsOptions.methods.join(', '));
            reply.header('Access-Control-Allow-Headers', corsOptions.allowedHeaders.join(', '));
            reply.header('Access-Control-Allow-Credentials', 'true');
        }
    }
    if (request.method === 'OPTIONS') {
        reply.status(204).send();
        return;
    }
    done();
});

app.register(jwt, { secret: process.env.JWT_SECRET });
app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024, files: 5 } });

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
    } 
});

console.log('🔍 Importando rotas...');

// Registro de todas as rotas
app.register(authRoutes, { prefix: `/auth` });
app.register(usuarioRoutes, { prefix: `/usuarios` });
app.register(vendasRoutes, { prefix: `/vendas` });
app.register(produtosRoutes, { prefix: '/produtos' });
app.register(pedidosRoutes, { prefix: `/pedidos` });

// Comente se não for necessário
// app.register(servicoRoutes, { prefix: `/produto` });

// Função auxiliar para listar rotas
const listRoutes = () => {
    console.log('\n📋 TODAS AS ROTAS REGISTRADAS:');
    console.log('================================');
    
    // Usando printRoutes() que é o método correto do Fastify v4
    const routes = app.printRoutes();
    console.log(routes);
    
    console.log('================================\n');
};

// Listar rotas quando o servidor estiver pronto
app.ready()
    .then(() => {
        listRoutes();
    })
    .catch(err => {
        console.error('Erro ao preparar servidor:', err);
    });

// Função para registrar rotas dinâmicas
(async () => {
    const dynamicRoutes = [
        { path: './modules/categorias/categorias.routes', prefix: '/categorias' },
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
            console.error(`❌ Erro ao importar rotas de ${prefix}:`, error.message);
            // Não é fatal, continue
        }
    }
})();

// Rotas básicas
app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.API_VERSION || '1.0.0'
}));

app.get('/', async () => ({
    message: 'Sufficius API está rodando!',
    version: process.env.API_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    docs: '/docs',
    health: '/health'
}));

export default app;