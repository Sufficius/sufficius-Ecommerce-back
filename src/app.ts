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

const app = Fastify({ logger: true });

const corsOptions = {
    origin: process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(',').map((o: string) => o.trim())
        : ['http://localhost:5173', 'http:localhost:3000', 'http://localhost:8080'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'X-Acess-Token', 'X-API-Key']
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
        info: { title: 'Sufficius API', description: 'API para a Sufficius E-commerce', version: process.env.API_VERSION || '1.0.0' },
        host: `localhost:${process.env.PORT || 3000}`,
        schemes: ['http', 'https'],
        consumes: ['application/json'],
        produces: ['application/json'],
        securityDefinitions: {
            bearerAuth: { type: 'apiKey', name: 'Authorization', in: 'header', description: 'Insira o token JWT no formato: Bearer {token}' }
        }
    }
});

app.register(swaggerUI, { routePrefix: "/docs", uiConfig: { docExpansion: 'list', deepLinking: true } });

// Registro de todas as rotas (sem await no top-level)
app.register(authRoutes, { prefix: `/auth` });
app.register(usuarioRoutes, { prefix: `/usuarios` });
app.register(servicoRoutes, { prefix: `/produto` });
app.register(vendasRoutes, { prefix: `/vendas` });
app.register(produtosRoutes, { prefix: '/produtos' });
app.register(pedidosRoutes, { prefix: `/pedidos` });

// Função para registrar rotas dinâmicas usando IIFE (Immediately Invoked Function Expression)
(() => {
    // Importar e registrar rotas dinamicamente sem await no top-level
    import('./modules/categorias/categorias.routes').then(module => {
        app.register(module.default, { prefix: `/categorias` });
    }).catch(error => {
        console.error('Erro ao importar rotas de categorias:', error);
    });

    import('./modules/avaliacoes/avaliacoes.routes').then(module => {
        app.register(module.default, { prefix: `/avaliacoes` });
    }).catch(error => {
        console.error('Erro ao importar rotas de avaliações:', error);
    });

    import('./modules/enderecos/enderecos.routes').then(module => {
        app.register(module.default, { prefix: `/enderecos` });
    }).catch(error => {
        console.error('Erro ao importar rotas de endereços:', error);
    });

    import('./modules/carrinho/carrinho.routes').then(module => {
        app.register(module.default, { prefix: `/carrinho` });
    }).catch(error => {
        console.error('Erro ao importar rotas de carrinho:', error);
    });


    import('./modules/pagamentos/pagamentos.routes').then(module => {
        app.register(module.default, { prefix: `/pagamentos` });
    }).catch(error => {
        console.error('Erro ao importar rotas de pagamentos:', error);
    });
})();

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