import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import jwt from 'jsonwebtoken';

export interface TokenPayload {
  id: number;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

// Extendendo a interface do FastifyRequest para adicionar propriedades customizadas
declare module 'fastify' {
  interface FastifyRequest {
    usuarioId: number;
    usuarioRole: string;
  }
}

export const autenticar = (
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
) => {
  const authHeader = request.headers.authorization;
  
  if (!authHeader) {
    return reply.status(401).send({
      erro: 'Token de autenticação não fornecido'
    });
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return reply.status(401).send({
      erro: 'Token de autenticação não fornecido'
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'seu_segredo_jwt'
    ) as TokenPayload;

    // Adicionar informações do usuário à requisição
    request.usuarioId = decoded.id;
    request.usuarioRole = decoded.role;

    done();
  } catch (error) {
    return reply.status(401).send({
      erro: 'Token inválido ou expirado'
    });
  }
};

export const autorizar = (rolesPermitidas: string[]) => {
  return (
    request: FastifyRequest,
    reply: FastifyReply,
    done: HookHandlerDoneFunction
  ) => {
    const usuarioRole = request.usuarioRole;

    if (!rolesPermitidas.includes(usuarioRole)) {
      return reply.status(403).send({
        erro: 'Acesso não autorizado'
      });
    }

    done();
  };
};