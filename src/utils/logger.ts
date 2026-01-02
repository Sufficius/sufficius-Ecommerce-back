import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';

// Configuração do logger
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isDevelopment ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
      messageFormat: '{msg}',
      singleLine: false
    }
  } : undefined,
  serializers: {
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    pid: process.pid,
    hostname: process.env.HOST || 'localhost',
    service: 'sufficius-backend',
    environment: process.env.NODE_ENV || 'development'
  },
  formatters: {
    level: (label) => ({ level: label.toUpperCase() }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      hostname: bindings.hostname,
      service: bindings.service
    })
  },
  // Formato correto para mensagens
  messageKey: 'msg'
});

// Métodos auxiliares para compatibilidade
export const logWithContext = (context: string) => ({
  info: (data: any, message?: string) => 
    logger.info({ ...data, context }, message),
  error: (data: any, message?: string) => 
    logger.error({ ...data, context }, message),
  warn: (data: any, message?: string) => 
    logger.warn({ ...data, context }, message),
  debug: (data: any, message?: string) => 
    logger.debug({ ...data, context }, message)
});

// Shorthands para uso comum
export const log = {
  info: (message: string, data?: any) => 
    logger.info(data || {}, message),
  error: (message: string, data?: any) => 
    logger.error(data || {}, message),
  warn: (message: string, data?: any) => 
    logger.warn(data || {}, message),
  debug: (message: string, data?: any) => 
    logger.debug(data || {}, message)
};