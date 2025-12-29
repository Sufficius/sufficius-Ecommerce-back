// src/middleware/rateLimit.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../utils/logger';

// Interface para configuração de rate limit
interface RateLimitConfig {
    windowMs: number;    // Janela de tempo em milissegundos
    max: number;         // Máximo de requisições por janela
    message?: string;    // Mensagem de erro
    statusCode?: number; // Status code de erro
    skipFailedRequests?: boolean; // Não contar requisições com erro
    keyGenerator?: (req: FastifyRequest) => string;
}

// Configurações padrão
const DEFAULT_CONFIG: RateLimitConfig = {
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100,                 // 100 requisições por 15 minutos
    message: 'Muitas requisições. Tente novamente mais tarde.',
    statusCode: 429,
    skipFailedRequests: false
};

// Armazenamento em memória (para desenvolvimento)
// Em produção, use Redis ou outro banco distribuído
const requestStore = new Map<string, {
    count: number;
    resetTime: number;
    firstRequestTime: number;
}>();

// Limpar requisições antigas periodicamente
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of requestStore.entries()) {
        if (data.resetTime <= now) {
            requestStore.delete(key);
        }
    }
}, 60000); // Limpar a cada minuto

// Gerar chave única para cada cliente
const defaultKeyGenerator = (req: FastifyRequest): string => {
    // Prioridade: IP real > IP do proxy > endereço remoto
    const ip = req.headers['x-real-ip'] ||
        req.headers['x-forwarded-for'] ||
        req.ip ||
        req.socket.remoteAddress;

    const path = req.routerPath || req.url;

    return `${ip}-${path}`;
};

// Classe principal de Rate Limiter
export class RateLimiter {
    private config: RateLimitConfig;
    private store = requestStore;

    constructor(config: Partial<RateLimitConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    // Verifica se a requisição deve ser bloqueada
    private shouldBlock(key: string): { blocked: boolean; retryAfter?: number; remaining?: number } {
        const now = Date.now();
        const windowMs = this.config.windowMs;

        if (!this.store.has(key)) {
            this.store.set(key, {
                count: 1,
                resetTime: now + windowMs,
                firstRequestTime: now
            });

            return {
                blocked: false,
                remaining: this.config.max - 1
            };
        }

        const data = this.store.get(key)!;

        // Se passou a janela de tempo, resetar
        if (now > data.resetTime) {
            this.store.set(key, {
                count: 1,
                resetTime: now + windowMs,
                firstRequestTime: now
            });

            return {
                blocked: false,
                remaining: this.config.max - 1
            };
        }

        // Incrementar contador
        data.count += 1;

        // Verificar se excedeu o limite
        if (data.count > this.config.max) {
            const retryAfter = Math.ceil((data.resetTime - now) / 1000);

            return {
                blocked: true,
                retryAfter,
                remaining: 0
            };
        }

        return {
            blocked: false,
            remaining: this.config.max - data.count
        };
    }

    // Middleware principal
    middleware() {
        return async (req: FastifyRequest, reply: FastifyReply) => {
            try {
                // Gerar chave única
                const keyGenerator = this.config.keyGenerator || defaultKeyGenerator;
                const key = keyGenerator(req);

                // Verificar se deve bloquear
                const result = this.shouldBlock(key);

                // Adicionar headers de rate limit
                // Na função middleware(), altere a criação dos headers:
                const headers: Record<string, string> = {
                    'X-RateLimit-Limit': this.config.max.toString(),
                    'X-RateLimit-Remaining': result.remaining?.toString() || '0',
                    'X-RateLimit-Reset': Math.floor(Date.now() / 1000 + this.config.windowMs / 1000).toString()
                };

                if (result.retryAfter) {
                    headers['Retry-After'] = result.retryAfter.toString();
                }

                // Adicionar headers à resposta
                reply.headers(headers);

                if (result.blocked) {
                    logger.warn({
                        message: 'Rate limit excedido',
                        ip: req.ip,
                        path: req.url,
                        method: req.method,
                        key: key,
                        retryAfter: result.retryAfter
                    });

                    return reply
                        .code(this.config.statusCode || 429)
                        .send({
                            success: false,
                            message: this.config.message || 'Muitas requisições',
                            retryAfter: result.retryAfter,
                            error: 'RATE_LIMIT_EXCEEDED'
                        });
                }

                // Log para debug (opcional)
                logger.debug({
                    message: 'Rate limit check',
                    ip: req.ip,
                    path: req.url,
                    remaining: result.remaining,
                    limit: this.config.max
                });

            } catch (error) {
                logger.error({
                    message: 'Erro no rate limiting',
                    error: error instanceof Error ? error.message : 'Erro desconhecido'
                });

                // Em caso de erro, permitir a requisição
                // (fail open para não quebrar o serviço)
            }
        };
    }

    // Resetar contadores para uma chave específica
    resetKey(key: string): void {
        this.store.delete(key);
    }

    // Obter status atual de uma chave
    getStatus(key: string) {
        return this.store.get(key);
    }
}

// Configurações pré-definidas para diferentes endpoints
export const authLimiter = new RateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10,                  // 10 tentativas de login
    message: 'Muitas tentativas de autenticação. Tente novamente em 15 minutos.',
    keyGenerator: (req) => {
        const ip = req.headers['x-real-ip'] || req.ip || 'unknown';
        return `auth-${ip}`;
    }
});

export const resetPasswordLimiter = new RateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 5,                   // 5 tentativas por hora
    message: 'Muitas tentativas de reset de senha. Tente novamente em 1 hora.',
    keyGenerator: (req) => {
        const ip = req.headers['x-real-ip'] || req.ip || 'unknown';
        const email = (req.body as any)?.email || 'unknown';
        return `reset-${ip}-${email}`;
    }
});

export const googleAuthLimiter = new RateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 20,                  // 20 tentativas
    message: 'Muitas tentativas de login com Google. Tente novamente em 15 minutos.',
    keyGenerator: (req) => {
        const ip = req.headers['x-real-ip'] || req.ip || 'unknown';
        return `google-auth-${ip}`;
    }
});

export const apiLimiter = new RateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 200,                 // 200 requisições gerais
    message: 'Muitas requisições à API. Tente novamente em 15 minutos.'
});

export const productLimiter = new RateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 1000,                // 1000 requisições de produtos por hora
    message: 'Limite de consultas a produtos excedido.'
});

// Middleware de rate limit global (para todas as rotas)
export const globalRateLimit = new RateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 500,                 // 500 requisições globais
    message: 'Limite global de requisições excedido.'
}).middleware();

// Utilitário para limpar rate limits (útil para testes)
export function clearRateLimitStore(): void {
    requestStore.clear();
    logger.info('Rate limit store limpo');
}

// Interface para status do rate limit
export interface RateLimitStatus {
    key: string;
    count: number;
    remaining: number;
    resetTime: Date;
    limit: number;
}

// Obter status de todas as chaves ativas
export function getActiveRateLimits(): RateLimitStatus[] {
    const now = Date.now();
    const activeLimits: RateLimitStatus[] = [];

    for (const [key, data] of requestStore.entries()) {
        if (data.resetTime > now) {
            activeLimits.push({
                key,
                count: data.count,
                remaining: Math.max(0, 100 - data.count), // Assumindo limite padrão
                resetTime: new Date(data.resetTime),
                limit: 100
            });
        }
    }

    return activeLimits;
}