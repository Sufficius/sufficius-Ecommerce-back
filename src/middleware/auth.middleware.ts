// src/middleware/auth.middleware.ts
import { FastifyRequest, FastifyReply } from 'fastify'

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
  } catch (err) {
    reply.status(401).send({
      success: false,
      message: 'Não autorizado. Token inválido ou expirado.'
    })
  }
}

export async function isAdmin(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
    const user = request.user as any
    if (user.tipo !== 'ADMIN') {
      reply.status(403).send({
        success: false,
        message: 'Acesso negado. Apenas administradores podem acessar.'
      })
    }
  } catch (err) {
    reply.status(401).send({
      success: false,
      message: 'Não autorizado. Token inválido ou expirado.'
    })
  }
}