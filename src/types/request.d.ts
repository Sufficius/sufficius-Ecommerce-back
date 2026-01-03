// src/types/request.d.ts
import { FastifyRequest } from 'fastify'

export interface PeriodoQuery {
  inicio?: string
  fim?: string
}

export type FastifyRequestWithPeriodo = FastifyRequest<{
  Querystring: PeriodoQuery
}>