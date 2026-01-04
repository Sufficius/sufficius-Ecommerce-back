import * as dotenv from "dotenv";
import app from './app';


// Carregar variáveis de ambiente
const envResult = dotenv.config();

// Se falhar, tentar .env padrão
if (envResult.error) {
  console.error(`❌ ERRO: Falha ao carregar arquivo .env `);
  console.error('Detalhe', envResult.error);

  // Tentar carregar sem caminho específico
  console.log('🔄 Tentando carregar .env do diretório atual...');
  dotenv.config();
}


// Verificar variáveis críticas
if (!process.env.JWT_SECRET) {
  console.error('❌ ERRO CRÍTICO: JWT_SECRET não está definido!');
  console.error('   Certifique-se de que o arquivo .env existe na raiz do projeto');
  console.error('   Verifique se JWT_SECRET está definido no arquivo .env');
  console.error('   Exemplo: JWT_SECRET="seu_segredo_aqui"');
  process.exit(1);
}

const port = Number(process.env.PORT) || 3333;

// Iniciar servidor
app.listen({ 
  port,
  host:'0.0.0.0'  // Adicione isso para aceitar conexões externas
}, (err, address) => {
  if (err) {
    console.error('❌ ERRO ao iniciar servidor:', err);
    process.exit(1);
  }


  console.log(`🚀 Servidor iniciado em ${address}`);
  console.log(`📚 Documentação: ${address}/docs`);
  console.log(`🏥 Health check: ${address}/health`);
  console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  
  if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
  console.log('🔧 Modo desenvolvimento - .env carregado');
} else {
  console.log('🚀 Modo produção - usando variáveis de ambiente do Render');
}

const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'PORT'];
requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    console.error(`❌ Variável de ambiente obrigatória não definida: ${varName}`);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
});
  // Mostrar variáveis carregadas (em desenvolvimento)
  if (process.env.NODE_ENV === 'development') {
    console.log('\n📋 Variáveis de ambiente carregadas:');
    console.log('   PORT:', process.env.PORT);
    console.log('   JWT_SECRET:', '***');
    console.log('   DATABASE_URL:', process.env.DATABASE_URL ? '*** (disponível)' : 'não definido');
    console.log('   CORS_ORIGINS:', process.env.CORS_ORIGINS);
  }
});