import Fastify from "fastify";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import * as dotenv from 'dotenv';



dotenv.config();

if(!process.env.JWT_SECRET){
    console.error("ERRO: JWT_SECRET não definido no .env");
    console.error("   Certifique-se de que o arquivo .env existe e tem JWT_SECRET");
    process.exit(1);
}

const app = Fastify({
    logger: true
});

const corsOptions = {
    origin: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:5173', 'http:localhost:3000'],
    credentials:true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'X-Acess-Token', 'X-API-Key']
};

app.addHook('onRequest', (request, reply, done)=> {
    const origin = request.headers.origin;

    if(origin){
        const allowedOrigins = corsOptions.origin;
        if(allowedOrigins.includes("*") || allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development'){
            reply.header('access-control-allow-origin', origin);
            reply.header('access-control-allow-methods', corsOptions.methods.join(', '));
            reply.header('access-control-allow-headers', corsOptions.allowedHeaders.join(', '));
            reply.header('access-control-allow-credentials', 'true');
        }
    }

    if(request.method === 'OPTIONS'){
        reply.status(204).send();
        return;
    }
    done();
});

app.register(jwt, {
    secret: process.env.JWT_SECRET
});

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

app.register(authRoutes, {prefix: "/auth"});



app.get('/', async ()=> {
    return {
        message: 'Sufficius API está rodando!',
        version:process.env.API_VERSION || '1.0.0',
         environment: process.env.NODE_ENV || 'development',
        docs: '/docs',
        health: '/health'
    }
})
export default app;
