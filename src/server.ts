import { config } from 'dotenv';
import { resolve } from 'path';
import app from './app';
import { logger } from './utils/logger';

// Configurar ambiente
const environment = process.env.NODE_ENV || 'development';
const envFile = `.env.${environment}`;

// Carregar variáveis de ambiente
const envResult = config({
  path: resolve(process.cwd(), envFile)
});

// Se falhar, tentar .env padrão
if (envResult.error && environment === 'development') {
  logger.warn(`Arquivo ${envFile} não encontrado, tentando .env padrão...`);
  config({ path: resolve(process.cwd(), '.env') });
}

// Interface para validação de variáveis críticas
interface RequiredEnvVars {
  JWT_SECRET: string;
  DATABASE_URL: string;
  PORT: string;
  CORS_ORIGINS: string;
}

// Validação de variáveis de ambiente críticas
const validateEnvironmentVariables = (): void => {
  const criticalVars: (keyof RequiredEnvVars)[] = [
    'JWT_SECRET',
    'DATABASE_URL',
    'PORT',
    'CORS_ORIGINS'
  ];

  const missingVars: string[] = [];

  criticalVars.forEach((varName) => {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  });

  if (missingVars.length > 0) {
    logger.error({
      msg: '❌ Variáveis de ambiente críticas não encontradas',
      missing: missingVars,
      environment,
      suggestion: `Verifique o arquivo ${envFile} ou .env na raiz do projeto`
    }, 'Erro de configuração');

    logger.info({
      msg: '📝 Variáveis necessárias',
      JWT_SECRET: 'Segredo para assinatura de tokens JWT',
      DATABASE_URL: 'URL de conexão com o banco de dados (ex: postgresql://user:pass@localhost:5432/db)',
      PORT: 'Porta do servidor (ex: 3333)',
      CORS_ORIGINS: 'Origens permitidas para CORS (ex: http://localhost:3000,https://sufficius.com)'
    }, 'Documentação de variáveis');

    process.exit(1);
  }
};

// Configuração do servidor
interface ServerConfig {
  port: number;
  host: string;
  environment: string;
  corsOrigins: string[];
}

const getServerConfig = (): ServerConfig => {
  const port = Number(process.env.PORT) || 3333;
  const host = process.env.HOST || '0.0.0.0';
  const corsOrigins = process.env.CORS_ORIGINS?.split(',').map(origin => origin.trim()) || [];

  return {
    port,
    host,
    environment,
    corsOrigins
  };
};

// Log inicial do ambiente
const logEnvironmentInfo = (config: ServerConfig): void => {
  logger.info({
    environment: config.environment,
    port: config.port,
    host: config.host,
    corsOrigins: config.corsOrigins.length > 0 ? config.corsOrigins : ['Todas (*)']
  }, '🚀 Iniciando Sufficius E-commerce Backend');

  if (environment === 'development') {
    logger.debug({
      DATABASE_URL: process.env.DATABASE_URL ? '*** (disponível)' : 'não definido',
      JWT_SECRET: '*** (disponível)',
      EMAIL_HOST: process.env.EMAIL_HOST || 'não definido',
      STRIPE_KEY: process.env.STRIPE_SECRET_KEY ? '*** (disponível)' : 'não definido',
      MP_ACCESS_TOKEN: process.env.MP_ACCESS_TOKEN ? '*** (disponível)' : 'não definido'
    }, '🔍 Variáveis de ambiente carregadas');
  }
};

// Manipulador de erros não tratados
const setupErrorHandlers = (): void => {
  process.on('uncaughtException', (error: Error) => {
    logger.error({
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    }, '💥 Erro não tratado');
    
    // Em produção, podemos querer reiniciar graciosamente
    if (environment === 'production') {
      setTimeout(() => process.exit(1), 1000);
    }
  });

  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error({
      reason: reason?.message || reason,
      timestamp: new Date().toISOString()
    }, '⚠️ Promise rejeitada não tratada');
  });
};

// Inicialização do servidor
const startServer = async (): Promise<void> => {
  try {
    // Validar ambiente
    validateEnvironmentVariables();
    
    // Configuração
    const serverConfig = getServerConfig();
    
    // Logs iniciais
    logEnvironmentInfo(serverConfig);
    
    // Configurar handlers de erro
    setupErrorHandlers();
    
    // Iniciar servidor
    await app.listen({
      port: serverConfig.port,
      host: serverConfig.host
    });

    // Log de sucesso
    logger.info({
      url: `http://${serverConfig.host}:${serverConfig.port}`,
      docs: `http://${serverConfig.host}:${serverConfig.port}/docs`,
      health: `http://${serverConfig.host}:${serverConfig.port}/health`,
      ready: new Date().toISOString(),
      environment: serverConfig.environment
    }, 'Servidor iniciado com sucesso!');

    // Log adicional para desenvolvimento
    if (environment === 'development') {
      console.log('\n📋 Rotas disponíveis:');
      console.log('   📚 API Docs  : /docs');
      console.log('   🏥 Health    : /health');
      console.log('   👤 Auth      : /api/auth/*');
      console.log('   🛍️ Produtos  : /api/products/*');
      console.log('   💰 Pedidos   : /api/orders/*');
      console.log('   📦 Pagamentos: /api/payments/*');
      console.log('   👥 Clientes  : /api/customers/*');
      console.log('   ⚙️ Config    : /api/config/*');
    }

  } catch (error: any) {
    logger.error({
      error: error.message,
      stack: error.stack,
      port: process.env.PORT,
      environment
    }, '❌ Falha ao iniciar servidor');
    
    process.exit(1);
  }
};

// Iniciar aplicação
startServer();

// Exportar para testes
export { validateEnvironmentVariables, getServerConfig, startServer };