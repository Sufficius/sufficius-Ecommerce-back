declare module '@fastify/multipart';
declare module '@fastify/swagger';
declare module '@fastify/swagger-ui';


// src/types/fastify.d.ts
import '@fastify/jwt'

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { 
      id: string 
      email: string
      tipo: string
    }
    user: {
      id: string
      email: string
      tipo: string
    }
  }
}