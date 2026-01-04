#!/usr/bin/env node
// scripts/setup-database.js - VERSÃO SEGURA

const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

console.log('🚀 Iniciando configuração do banco de dados...');

async function setupDatabase() {
  try {
    // 1. Verificar variáveis de ambiente
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL não está definida');
      process.exit(1);
    }

    console.log('📦 NODE_ENV:', process.env.NODE_ENV);
    console.log('🔗 DATABASE_URL definida: SIM');

    // 2. Gerar Prisma Client
    console.log('\n🔧 1/3 Gerando Prisma Client...');
    execSync('npx prisma generate', { 
      stdio: 'inherit',
      timeout: 30000 
    });

    // 3. Criar tabelas
    console.log('\n📦 2/3 Criando tabelas...');
    execSync('npx prisma db push --accept-data-loss', { 
      stdio: 'inherit',
      timeout: 60000 
    });
    console.log('✅ Tabelas criadas!');

    // 4. Criar usuário admin
    console.log('\n👑 3/3 Criando usuário admin...');
    const prisma = new PrismaClient();
    
    // Usar variáveis de ambiente - SEGURO!
    const adminEmail = process.env.ADMIN_EMAIL || 'andrescorporate1@gmail.com';
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (!adminPassword) {
      console.log('⚠️  ADMIN_PASSWORD não definida');
      console.log('ℹ️  Pule esta etapa e crie o usuário manualmente depois');
      console.log('ℹ️  Ou defina ADMIN_PASSWORD no Render');
      await prisma.$disconnect();
      return;
    }
    
    const adminHashedPassword = await bcrypt.hash(adminPassword, 10);
    
    await prisma.usuario.upsert({
      where: { email: adminEmail },
      update: {
        senhaHash: adminHashedPassword,
        tipo: 'ADMIN',
        emailVerificado: true
      },
      create: {
        email: adminEmail,
        nome: 'Administrador',
        telefone: `admin_${Date.now()}`,
        senhaHash: adminHashedPassword,
        tipo: 'ADMIN',
        emailVerificado: true,
        telefoneVerificado: false,
        status: 'ATIVO'
      }
    });
    
    console.log(`✅ Usuário admin criado: ${adminEmail}`);
    await prisma.$disconnect();
    
    console.log('\n🎉 Configuração concluída com sucesso!');
    
  } catch (error) {
    console.error('\n❌ Erro na configuração:', error.message);
    process.exit(1);
  }
}

setupDatabase();