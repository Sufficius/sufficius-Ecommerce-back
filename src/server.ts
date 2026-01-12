// src/server.ts
import * as dotenv from "dotenv";
import app from './app';

// Carregar variáveis de ambiente
dotenv.config();

// Verificar variáveis críticas
if (!process.env.JWT_SECRET) {
  console.error('❌ ERRO CRÍTICO: JWT_SECRET não está definido!');
  process.exit(1);
}

const PORT = Number(process.env.PORT) || 3333;
const HOST = process.env.HOST || '0.0.0.0';

// CONFIGURAR TIMEOUTS (IMPORTANTE!)
app.server.setTimeout(300000); // 5 minutos
app.server.keepAliveTimeout = 300000;
app.server.headersTimeout = 300000;

// Iniciar servidor
const startServer = async () => {
  try {
    await app.listen({
      port: PORT,
      host: HOST
    });

    console.log('\n' + '='.repeat(50));
    console.log(`🚀 Servidor iniciado em http://${HOST}:${PORT}`);
    console.log(`📚 Documentação: http://${HOST}:${PORT}/docs`);
    console.log(`🏥 Health check: http://${HOST}:${PORT}/health`);
    console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log('='.repeat(50) + '\n');

    // Log de configuração do servidor
    console.log('🔧 Configuração do servidor:');
    console.log(`   Timeout: ${app.server.timeout}ms`);
    console.log(`   Body Limit: ${app.initialConfig.bodyLimit} bytes`);
    console.log(`   Connection Timeout: ${app.initialConfig.connectionTimeout}ms`);
    
  } catch (err) {
    console.error('❌ ERRO ao iniciar servidor:', err);
    process.exit(1);
  }
};

startServer();