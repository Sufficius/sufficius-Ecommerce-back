import fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import passport from '@fastify/passport'
import RealTimeService from "./services/websockets";
import multipart from '@fastify/multipart'
import fastifyCookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';

import path from 'path';
import Routes from "./routes";




const app: FastifyInstance = fastify({ logger: true })
const realtimeService = new RealTimeService(app)
app.decorate("ws", realtimeService)

const start = async () => {
    try {
        app.register(fastifyCookie)
        await app.register(require('@fastify/secure-session'), {
            secret: process.env.JWT_SECRET as string,
            cookie: {
                secure: false,
                httpOnly: true,
            },
            saveUninitialized: false,
            resave: false
        });
           await app.register(cors, {
      origin: ['http://localhost:5173' , 'http://localhost:5174', 'http://localhost:5175'],
      credentials: true
    });

      app.register(multipart, {
      limits: {
        fieldNameSize: 100,
        fieldSize: 100,
        fields: 10,
        fileSize: 2 * 1024 * 1024,
        files: 1,
        headerPairs: 2000,
        parts: 1000
      }
    })
     app.register(fastifyStatic, {
      root: path.join(__dirname, 'uploads'),
      prefix: '/static/',
    });

      await app.register(passport.initialize());
    await app.register(passport.secureSession());

    app.register(Routes)
    await app.listen({port: 3000}, ()=> {
        console.log(`Server is running port 3000`)
    })
    } catch (err){
        console.log(err);
        app.log.error(err);
        process.exit(1);
    }
};
start();