// src/@types/fastify-jwt.d.ts
import '@fastify/jwt';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { 
      id: string; 
      email: string; 
      tipo: string;
      fotoUrl?: string; // 👈 ADICIONAR FOTOURL
      nome?: string;
    };
    user: {
      id: string;
      email: string;
      tipo: string;
      fotoUrl?: string; // 👈 ADICIONAR FOTOURL
      nome?: string;
    }
  }
}