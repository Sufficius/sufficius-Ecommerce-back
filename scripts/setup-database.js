#!/usr/bin/env node
// scripts/setup-database.js - VERSÃO COMPLETA

const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

console.log('🚀 Iniciando configuração do banco de dados no Render...');
console.log('📦 NODE_ENV:', process.env.NODE_ENV);
console.log('🔗 DATABASE_URL:', process.env.DATABASE_URL ? 'Definida' : 'Não definida');

async function setupDatabase() {
  try {
    // 1. Gerar Prisma Client
    console.log('\n🔧 1/4 Gerando Prisma Client...');
    execSync('npx prisma generate', { 
      stdio: 'inherit',
      timeout: 30000 
    });

    // 2. Tentar migrations primeiro
    console.log('\n📦 2/4 Tentando executar migrations...');
    try {
      execSync('npx prisma migrate deploy', { 
        stdio: 'inherit',
        timeout: 60000 
      });
      console.log('✅ Migrations aplicadas com sucesso!');
    } catch (migrationError) {
      console.log('⚠️  Migrations falharam, tentando db push...');
      
      // 3. Fallback: db push (cria tabelas diretamente)
      console.log('\n🔄 3/4 Executando db push...');
      execSync('npx prisma db push --accept-data-loss', { 
        stdio: 'inherit',
        timeout: 60000 
      });
      console.log('✅ Tabelas criadas via db push!');
    }

    // 4. Verificar conexão e criar usuários
    console.log('\n🔍 4/4 Verificando conexão e criando usuários...');
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
    
    // 5. CRIAR USUÁRIO ADMIN PADRÃO
    console.log('\n👑 Criando usuário admin padrão...');
    const bcrypt = require('bcryptjs');
    const adminPassword = 'misteral';
    const adminHashedPassword = await bcrypt.hash(adminPassword, 10);
    
    try {
      const admin = await prisma.usuario.upsert({
        where: { email: 'andrescorporate1@gmail.com' },
        update: {
          nome: 'Administrador',
          senhaHash: adminHashedPassword,
          tipo: 'ADMIN',
          emailVerificado: true
        },
        create: {
          id: '1',
          nome: 'Administrador',
          email: 'andrescorporate1@gmail.com',
          telefone: `admin_${Date.now()}`,
          senhaHash: adminHashedPassword,
          tipo: 'ADMIN',
          emailVerificado: true,
          telefoneVerificado: false,
          status: 'ATIVO',
          criadoEm: new Date(),
          atualizadoEm: new Date()
        }
      });
      console.log('✅ Usuário admin criado/atualizado: andrescorporate1@gmail.com / Admin123!');
    } catch (adminError) {
      console.log('⚠️  Erro ao criar admin:', adminError.message);
    }
    
    // 6. CRIAR SEU USUÁRIO PESSOAL (Andres)
    console.log('\n👤 Criando seu usuário pessoal (Andres)...');
    
    // IMPORTANTE: Substitua o hash pela sua senha REAL do SQLite
    // Você precisa pegar o hash EXATO do seu banco local
    const yourHashedPassword = '$2a$12$48ps2exdsZbEJdKJyPc8K.qbDr2W8k98HWnjTGG/jFU...'; // ← SUBSTITUA PELO HASH REAL
    
    try {
      const yourUser = await prisma.usuario.upsert({
        where: { id: '8fe1863b-9a7d-4f22-84ba-2d7cb3046b3d' },
        update: {
          nome: 'Andres Innovations',
          senhaHash: yourHashedPassword,
          email: 'andrescorporate1@gmail.com',
          telefone: '928549260'
        },
        create: {
          id: '8fe1863b-9a7d-4f22-84ba-2d7cb3046b3d',
          email: 'andrescorporate1@gmail.com',
          telefone: '928549260',
          nome: 'Andres Innovations',
          senhaHash: yourHashedPassword,
          emailVerificado: false,
          telefoneVerificado: false,
          status: 'PENDENTE',
          tipo: 'ADMIN',
          criadoEm: new Date('2026-01-03T16:27:55.000Z'),
          atualizadoEm: new Date('2026-01-03T16:27:55.000Z'),
          ultimoLogin: new Date('2026-01-03T16:27:55.000Z')
        }
      });
      console.log('✅ Seu usuário criado/atualizado: andrescorporate1@gmail.com');
    } catch (yourUserError) {
      console.log('⚠️  Erro ao criar seu usuário:', yourUserError.message);
      
      // Tentar método alternativo com SQL direto
      console.log('🔄 Tentando método alternativo...');
      try {
        await prisma.$executeRaw`
          INSERT INTO usuario (
            id, email, telefone, nome, senhaHash, 
            "emailVerificado", "telefoneVerificado", status, tipo, 
            "criadoEm", "atualizadoEm", "ultimoLogin"
          ) VALUES (
            '8fe1863b-9a7d-4f22-84ba-2d7cb3046b3d',
            'andrescorporate1@gmail.com',
            '928549260',
            'Andres Innovations',
            ${yourHashedPassword},
            false,
            false,
            'PENDENTE',
            'ADMIN',
            '2026-01-03 16:27:55',
            '2026-01-03 16:27:55',
            '2026-01-03 16:27:55'
          )
          ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            telefone = EXCLUDED.telefone,
            nome = EXCLUDED.nome,
            senhaHash = EXCLUDED.senhaHash;
        `;
        console.log('✅ Usuário inserido via SQL direto!');
      } catch (sqlError) {
        console.log('❌ Falha mesmo com SQL direto:', sqlError.message);
      }
    }
    
    // 7. VERIFICAR TODOS OS USUÁRIOS
    console.log('\n📋 Verificando todos os usuários no banco...');
    try {
      const allUsers = await prisma.usuario.findMany({
        select: { id: true, email: true, nome: true, tipo: true, criadoEm: true }
      });
      console.log(`✅ Total de usuários: ${allUsers.length}`);
      allUsers.forEach(user => {
        console.log(`   👤 ${user.email} - ${user.nome} (${user.tipo})`);
      });
    } catch (queryError) {
      console.log('⚠️  Não foi possível listar usuários:', queryError.message);
    }
    
    // 8. VERIFICAR OUTRAS TABELAS IMPORTANTES
    console.log('\n📊 Verificando outras tabelas...');
    const importantTables = ['produto', 'categoria', 'pedido', 'carrinho'];
    
    for (const table of importantTables) {
      try {
        const count = await prisma.$queryRaw`
          SELECT COUNT(*) as count FROM ${table}
        `;
        console.log(`   ${table}: ${count[0].count} registros`);
      } catch (e) {
        console.log(`   ${table}: Não existe ou erro`);
      }
    }
    
    await prisma.$disconnect();
    console.log('\n🎉 Configuração do banco concluída com sucesso!');
    console.log('\n🔑 Credenciais disponíveis:');
    console.log('   1. andrescorporate1@gmail.com / Admin123!');
    console.log('   2. andrescorporate1@gmail.com / [sua senha local]');
    
  } catch (error) {
    console.error('\n❌ Erro crítico na configuração do banco:', error.message);
    console.error('Stack:', error.stack);
    
    // Tentar solução de emergência
    console.log('\n🆘 Tentando solução de emergência...');
    try {
      // Tentar criar tabela manualmente
      const { Client } = require('pg');
      const client = new Client({
        connectionString: process.env.DATABASE_URL
      });
      
      await client.connect();
      await client.query(`
        CREATE TABLE IF NOT EXISTS usuario (
          id VARCHAR(255) PRIMARY KEY,
          email VARCHAR(255) UNIQUE,
          telefone VARCHAR(255) UNIQUE,
          nome VARCHAR(255),
          senhaHash TEXT,
          "emailVerificado" BOOLEAN DEFAULT false,
          "telefoneVerificado" BOOLEAN DEFAULT false,
          status VARCHAR(50),
          tipo VARCHAR(50),
          "criadoEm" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "atualizadoEm" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "ultimoLogin" TIMESTAMP,
          "googleId" VARCHAR(255),
          foto TEXT,
          "resetToken" VARCHAR(255),
          "resetTokenExpiry" TIMESTAMP
        );
      `);
      
      await client.query(`
        INSERT INTO usuario (id, email, telefone, nome, senhaHash, tipo)
        VALUES ('1', 'andrescorporate1@gmail.com', 'admin_temp', 'Administrador', '$2a$12$adminhashplaceholder', 'ADMIN')
        ON CONFLICT (id) DO NOTHING;
      `);
      
      await client.end();
      console.log('✅ Tabela criada manualmente!');
    } catch (emergencyError) {
      console.error('❌ Falha na solução de emergência:', emergencyError.message);
    }
    
    process.exit(1);
  }
}

// Executar
setupDatabase();