#!/usr/bin/env node
// scripts/setup-database.js

const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

console.log('🚀 Iniciando configuração do banco de dados no Render...');
console.log('📦 NODE_ENV:', process.env.NODE_ENV);
console.log('🔗 DATABASE_URL:', process.env.DATABASE_URL ? 'Definida' : 'Não definida');

async function setupDatabase() {
  try {
    // 1. Gerar Prisma Client
    console.log('🔧 1/4 Gerando Prisma Client...');
    execSync('npx prisma generate', { 
      stdio: 'inherit',
      timeout: 30000 
    });

    // 2. Tentar migrations primeiro
    console.log('📦 2/4 Tentando executar migrations...');
    try {
      execSync('npx prisma migrate deploy', { 
        stdio: 'inherit',
        timeout: 60000 
      });
      console.log('✅ Migrations aplicadas com sucesso!');
    } catch (migrationError) {
      console.log('⚠️  Migrations falharam, tentando db push...');
      
      // 3. Fallback: db push (cria tabelas diretamente)
      console.log('🔄 3/4 Executando db push...');
      execSync('npx prisma db push --accept-data-loss', { 
        stdio: 'inherit',
        timeout: 60000 
      });
      console.log('✅ Tabelas criadas via db push!');
    }

    // 4. Verificar conexão e criar admin
    console.log('🔍 4/4 Verificando conexão...');
    const prisma = new PrismaClient();
    
    // Testar conexão
    await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Conexão com banco estabelecida!');
    
    // Verificar se tabela usuario existe
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_name = 'usuario'
    `;
    
    if (tables.length === 0) {
      console.log('❌ Tabela usuario ainda não existe!');
      console.log('📋 Listando todas as tabelas:');
      const allTables = await prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `;
      console.log('Tabelas encontradas:', allTables.map(t => t.table_name));
    } else {
      console.log('✅ Tabela usuario encontrada!');
    }
    
    // Criar usuário admin se não existir
    const adminCount = await prisma.usuario.count({
      where: { email: 'admin@sufficius.com' }
    });
    
    if (adminCount === 0) {
      console.log('👑 Criando usuário admin padrão...');
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('Admin123!', 10);
      
      await prisma.usuario.create({
        data: {
          nome: 'Administrador',
          email: 'admin@sufficius.com',
          telefone: `admin_${Date.now()}`,
          senhaHash: hashedPassword,
          tipo: 'ADMIN',
          emailVerificado: true,
          id:"1"
        }
      });
      console.log('✅ Usuário admin criado: admin@sufficius.com / Admin123!');
    } else {
      console.log('✅ Usuário admin já existe');
    }
    
    await prisma.$disconnect();
    console.log('🎉 Configuração do banco concluída com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro crítico na configuração do banco:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

setupDatabase();