// src/types/fastify.d.ts
import '@fastify/jwt'
declare module '@fastify/multipart';
declare module '@fastify/swagger';
declare module '@fastify/swagger-ui';

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
      nome?:string
    }
    user: {
      id: string
      email: string
      tipo: string
      nome?: string 
    }
  }
}


declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      tipo: string;
      nome?: string;
    }
  }
}

// Tipos para requests
export interface PaginatedQuery {
  page?: string;
  limit?: string;
  search?: string;
}

export interface IdParam {
  id: string;
}

export interface SlugParam {
  slug: string;
}