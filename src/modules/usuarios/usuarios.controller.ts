// src/controllers/UsuariosController.ts - VERSÃO CORRIGIDA
import { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { success } from 'zod';
import { Console } from 'winston/lib/winston/transports';

const prisma = new PrismaClient();

// Tipos para as requisições
interface CriarUsuarioBody {
  nome: string;
  email: string;
  senha: string;
  telefone?: string;
  tipo?: string;
  dataNascimento?: string;
  endereco?: string;
  fotoUrl?:string;
}

interface LoginBody {
  email: string;
  senha: string;
}

interface AtualizarUsuarioBody {
  nome?: string;
  email?: string;
  telefone?: string;
  senha?: string;
  tipo?: string;
  dataNascimento?: string;
  fotoUrl?:string;
}

interface ListarUsuariosQuery {
  page?: string;
  limit?: string;
  busca?: string;
  tipo?: string;
}

export class UsuariosController {
  // Função de validação de email
  private validarEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Função para validar senha
  private validarSenha(senha: string): { valido: boolean; mensagem?: string } {
    if (senha.length < 6) {
      return { valido: false, mensagem: 'Senha deve ter pelo menos 6 caracteres' };
    }
    return { valido: true };
  }

  // Criar novo usuário
  async criarUsuario(request: FastifyRequest<{ Body: CriarUsuarioBody }>, reply: FastifyReply) {
    try {

      // Verificar autenticação (apenas ADMIN pode criar usuários)
      const usuarioAutenticado = request.user;

      if (!usuarioAutenticado || usuarioAutenticado.tipo !== 'ADMIN') {
        return reply.status(403).send({
          success: false,
          error: 'Apenas administradores podem criar usuários',
          debug: {
            usuarioAutenticado,
            esperado: 'ADMIN',
            recebido: usuarioAutenticado?.tipo
          }
        });
      }

      const { nome, email, tipo, telefone, senha, dataNascimento,endereco, fotoUrl } = request.body;

      // Validações básicas
      if (!nome || !email || !senha) {
        return reply.status(400).send({
          success: false,
          error: 'Nome, email e senha são obrigatórios'
        });
      }

      if (!this.validarEmail(email)) {
        return reply.status(400).send({
          success: false,
          error: 'Email inválido'
        });
      }

      const validacaoSenha = this.validarSenha(senha);
      if (!validacaoSenha.valido) {
        return reply.status(400).send({
          success: false,
          error: validacaoSenha.mensagem
        });
      }

      // Verificar se email já existe
      const usuarioExistente = await prisma.usuario.findUnique({
        where: { email }
      });

      if (usuarioExistente) {
        return reply.status(409).send({
          success: false,
          error: 'Email já cadastrado'
        });
      }

      // Verificar se telefone já existe (se fornecido)
      if (telefone && telefone.trim() !== '') {
        const telefoneExistente = await prisma.usuario.findUnique({
          where: { telefone }
        });

        if (telefoneExistente) {
          return reply.status(409).send({
            success: false,
            error: 'Telefone já cadastrado'
          });
        }
      }

      // Validar tipo de usuário
      const tiposPermitidos = ['CLIENTE', 'OPERADOR', 'ADMIN'];
      const tipoUsuario = tipo && tiposPermitidos.includes(tipo) ? tipo : 'CLIENTE';

      // Criptografar senha
      const senhaCriptografada = await bcrypt.hash(senha, 10);

      // Preparar dados para criação
      const dadosUsuario: any = {
        nome,
        email,
        senhaHash: senhaCriptografada,
        telefone: telefone || '',
        fotoUrl: fotoUrl || null,
        tipo: tipoUsuario,
      };

      // Adicionar data de nascimento se fornecida
      if (dataNascimento) {
        dadosUsuario.dataNascimento = new Date(dataNascimento);
      }
      // Criar usuário
      const usuario = await prisma.usuario.create({
        data: dadosUsuario
      });

      // Criar endereço se fornecido
      if (endereco) {
        try {
          await prisma.endereco.create({
            data: {
              id: usuario.id,
              rua: endereco,
              usuarioId: usuario.id,
              padrao: true,
              bairro: 'Luanda',
              cidade: 'Luanda',
              numero: 's/n'
            }
          });
        } catch (enderecoError) {
          console.error('Erro ao criar endereço:', enderecoError);
          // Não falhar se o endereço não for criado
        }
      }

      // Retornar resposta sem a senha
      const usuarioCriado = await prisma.usuario.findUnique({
        where: { id: usuario.id },
        select: {
          id: true,
          nome: true,
          email: true,
          telefone: true,
          tipo: true,
          fotoUrl:true,
          dataNascimento: true,
          criadoEm: true,
          atualizadoEm: true,
        }
      });

      return reply.status(201).send({
        success: true,
        message: 'Usuário criado com sucesso',
        data: usuarioCriado
      });

    } catch (error) {
      console.error('❌ Erro ao criar usuário:', error);

      // Verificar se é erro do Prisma
      if (error instanceof Error) {
        console.error('Detalhes do erro:', error.message);
        console.error('Stack trace:', error.stack);
      }

      return reply.status(500).send({
        success: false,
        error: 'Erro interno do servidor ao criar usuário',
        details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
      });
    }
  }

  // Listar todos os usuários (com paginação)
  async listarUsuarios(request: FastifyRequest<{ Querystring: ListarUsuariosQuery }>, reply: FastifyReply) {
    try {
      const { page = '1', limit = '10', busca, tipo } = request.query;

      const pageNumber = parseInt(page);
      const limitNumber = parseInt(limit);
      const skip = (pageNumber - 1) * limitNumber;

      // Construir condições de busca
      const whereClause: any = {};

      if (busca) {
        whereClause.OR = [
          { nome: { contains: busca, mode: 'insensitive' } },
          { email: { contains: busca, mode: 'insensitive' } },
          { telefone: { contains: busca, mode: 'insensitive' } }
        ];
      }

      if (tipo && tipo !== 'todos') {
        whereClause.tipo = tipo;
      }

      // Buscar usuários
      const [usuarios, total] = await Promise.all([
        prisma.usuario.findMany({
          where: whereClause,
          select: {
            id: true,
            nome: true,
            email: true,
            telefone: true,
            tipo: true,
            dataNascimento: true,
            criadoEm: true,
            atualizadoEm: true,
            fotoUrl:true,
            status:true,
          },
          skip,
          take: limitNumber,
          orderBy: { criadoEm: 'desc' }
        }),
        prisma.usuario.count({ where: whereClause })
      ]);


      // Formatar resposta
      return reply.send({
        success: true,
        data: usuarios.map(usuario => ({
          id: usuario.id,
          nome: usuario.nome,
          email: usuario.email,
          telefone: usuario.telefone,
          tipo: usuario.tipo,
          dataNascimento: usuario.dataNascimento?.toISOString().split('T')[0],
          criadoEm: usuario.criadoEm.toISOString(),
          atualizadoEm: usuario.atualizadoEm.toISOString(),
          status: usuario.status,
          fotoUrl: usuario.fotoUrl
        })),
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          total,
          totalPages: Math.ceil(total / limitNumber)
        }
      });

    } catch (error) {
      console.error('❌ Erro ao listar usuários:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }

  // Obter usuário por ID
  async obterUsuarioPorId(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    try {
      const { id } = request.params;

      const usuario = await prisma.usuario.findUnique({
        where: { id: id },
        select: {
          id: true,
          nome: true,
          email: true,
          telefone: true,
          tipo: true,
          dataNascimento: true,
          criadoEm: true,
          atualizadoEm: true,
          fotoUrl:true
        }
      });

      if (!usuario) {
        return reply.status(404).send({
          success: false,
          error: 'Usuário não encontrado'
        });
      }

      return reply.send({
        success: true,
        data: {
          ...usuario,
          dataNascimento: usuario.dataNascimento?.toISOString().split('T')[0],
        }
      });

    } catch (error) {
      console.error('❌ Erro ao obter usuário:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }

  // Atualizar usuário
  async atualizarUsuario(
    request: FastifyRequest<{
      Params: { id: string };
      Body: AtualizarUsuarioBody;
    }>,
    reply: FastifyReply
  ) {
    try {
      const { id } = request.params;
      const { nome, email, telefone, senha, tipo, dataNascimento } = request.body;

      // Verificar autenticação
      const usuarioAutenticado = request.user;

      if (!usuarioAutenticado) {
        return reply.status(401).send({
          success: false,
          error: 'Não autorizado'
        });
      }

      // Verificar se usuário existe
      const usuarioExistente = await prisma.usuario.findUnique({
        where: { id: id }
      });

      if (!usuarioExistente) {
        return reply.status(404).send({
          success: false,
          error: 'Usuário não encontrado'
        });
      }

      // Preparar dados para atualização
      const dadosAtualizacao: any = {};

      if (nome) dadosAtualizacao.nome = nome;

      if (telefone !== undefined) {
        if (telefone !== usuarioExistente.telefone) {
          if (telefone && telefone.trim() !== '') {
            const telefoneExistente = await prisma.usuario.findFirst({
              where: {
                telefone: telefone,
                NOT: { id: id }
              }
            });

            if (telefoneExistente) {
              return reply.status(409).send({
                success: false,
                error: 'Telefone já está em uso por outro usuário'
              });
            }
            dadosAtualizacao.telefone = telefone;
          }
          else {
            dadosAtualizacao.telefone = '';
          }
        }
      }

      if (tipo && ['CLIENTE', 'OPERADOR', 'ADMIN'].includes(tipo)) {
        dadosAtualizacao.tipo = tipo;
      }

      if (dataNascimento) {
        dadosAtualizacao.dataNascimento = new Date(dataNascimento);
      }

      // Verificar se email já existe (se estiver sendo alterado)
      if (email && email !== usuarioExistente.email) {
        if (!this.validarEmail(email)) {
          return reply.status(400).send({
            success: false,
            error: 'Email inválido'
          });
        }

        const emailExistente = await prisma.usuario.findUnique({
          where: { email }
        });

        if (emailExistente) {
          return reply.status(409).send({
            success: false,
            error: 'Email já está em uso por outro usuário'
          });
        }
        dadosAtualizacao.email = email;
      }

      // Se houver senha, criptografar
      if (senha) {
        const validacaoSenha = this.validarSenha(senha);
        if (!validacaoSenha.valido) {
          return reply.status(400).send({
            success: false,
            error: validacaoSenha.mensagem
          });
        }
        dadosAtualizacao.senhaHash = await bcrypt.hash(senha, 10);
      }

      if (Object.keys(dadosAtualizacao).length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'Nenhum dado fornecido para atualização'
        });
      }

      const usuarioAtualizado = await prisma.usuario.update({
        where: { id: id },
        data: dadosAtualizacao,
        select: {
          id: true,
          nome: true,
          email: true,
          telefone: true,
          tipo: true,
          fotoUrl:true,
          dataNascimento: true,
          criadoEm: true,
          atualizadoEm: true
        }
      });

      return reply.send({
        success: true,
        message: 'Usuário atualizado com sucesso',
        data: {
          ...usuarioAtualizado,
          dataNascimento: usuarioAtualizado.dataNascimento?.toISOString().split('T')[0]
        }
      });

    } catch (error: any) {
      console.error('❌ Erro ao atualizar usuário:', error);

      if (error.code === 'P2002') {
        const target = error.meta?.target;
        let mensagem = 'Erro de duplicidade';

        if (target?.includes('telefone')) {
          mensagem = 'Telefone já está em uso por outro usuário';
        } else if (target?.includes('email')) {
          mensagem = 'Email já está em uso por outro usuário';
        }

        return reply.status(409).send({
          success: false,
          error: mensagem,
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }

      if (error.code === 'P2003' || error.message.includes('must not be null')) {
        return reply.status(400).send({
          success: false,
          error: 'Campo telefone não pode ser nulo. Use uma string vazia "" se necessário.'
        });
      }

      return reply.status(500).send({
        success: false,
        error: 'Erro interno do servidor',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  // Deletar usuário
  async deletarUsuario(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    try {
      const { id } = request.params;

      // Verificar autenticação (apenas ADMIN pode deletar)
      const usuarioAutenticado = request.user;

      if (!usuarioAutenticado || usuarioAutenticado.tipo !== 'ADMIN') {
        return reply.status(403).send({
          success: false,
          error: 'Apenas administradores podem deletar usuários'
        });
      }

      // Verificar se usuário existe
      const usuarioExistente = await prisma.usuario.findUnique({
        where: { id: id }
      });

      if (!usuarioExistente) {
        return reply.status(404).send({
          success: false,
          error: 'Usuário não encontrado'
        });
      }

      // Não permitir deletar o próprio usuário
      if (usuarioAutenticado.id === id) {
        return reply.status(400).send({
          success: false,
          error: 'Não é possível deletar seu próprio usuário'
        });
      }

      // Deletar usuário
      await prisma.usuario.delete({
        where: { id: id }
      });

      return reply.send({
        success: true,
        message: 'Usuário deletado com sucesso'
      });

    } catch (error) {
      console.error('❌ Erro ao deletar usuário:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }

  // Login de usuário
  async login(request: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) {
    try {
      const { email, senha } = request.body;

      // Validação
      if (!email || !senha) {
        return reply.status(400).send({
          success: false,
          error: 'Email e senha são obrigatórios'
        });
      }

      if (!this.validarEmail(email)) {
        return reply.status(400).send({
          success: false,
          error: 'Email inválido'
        });
      }

      // Buscar usuário
      const usuario = await prisma.usuario.findUnique({
        where: { email }
      });

      if (!usuario) {
        return reply.status(401).send({
          success: false,
          error: 'Credenciais inválidas'
        });
      }

      // Verificar senha
      const senhaValida = await bcrypt.compare(senha, usuario.senhaHash);

      if (!senhaValida) {
        return reply.status(401).send({
          success: false,
          error: 'Credenciais inválidas'
        });
      }

      // Gerar token JWT usando o Fastify JWT
      const token = await reply.jwtSign({
        id: usuario.id,
        email: usuario.email,
        tipo: usuario.tipo
      }, {
        expiresIn: '7d'
      });

      return reply.send({
        success: true,
        message: 'Login realizado com sucesso',
        data: {
          token,
          usuario: {
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            tipo: usuario.tipo,
            telefone: usuario.telefone,
            fotoUrl: usuario.fotoUrl
          }
        }
      });

    } catch (error) {
      console.error('❌ Erro ao fazer login:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }

  // Obter perfil do usuário autenticado
  async obterPerfil(request: FastifyRequest, reply: FastifyReply) {
    try {
      const usuarioAutenticado = request.user;

      if (!usuarioAutenticado) {
        return reply.status(401).send({
          success: false,
          error: 'Não autorizado'
        });
      }


      const usuario = await prisma.usuario.findUnique({
        where: { id: usuarioAutenticado.id },
        select: {
          id: true,
          nome: true,
          email: true,
          telefone: true,
          tipo: true,
          dataNascimento: true,
          fotoUrl:true,
          criadoEm: true,
          atualizadoEm: true,
        }
      });

      if (!usuario) {
        return reply.status(404).send({
          success: false,
          error: 'Usuário não encontrado'
        });
      }

      return reply.send({
        success: true,
        data: {
          ...usuario,
          dataNascimento: usuario.dataNascimento?.toISOString().split('T')[0],
        }
      });

    } catch (error) {
      console.error('❌ Erro ao obter perfil:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }

  // Alterar status do usuário
  async alterarStatusUsuario(request: FastifyRequest<{
    Params: { id: string };
    Body: { status: string }
  }>, reply: FastifyReply) {
    try {
      const { id } = request.params;
      const {status} = request.body;


      let novoStatus = ""
      if(status === "Ativo"){
        novoStatus = "Inativo"
      }
      else {
        novoStatus = status
      }
    
      // Verificar autenticação (apenas ADMIN pode alterar status)
      const usuarioAutenticado = request.user;

      if (!usuarioAutenticado || usuarioAutenticado.tipo !== 'ADMIN') {
        return reply.status(403).send({
          success: false,
          error: 'Apenas administradores podem alterar status'
        });
      }

      // Verificar se status é válido
      if (!['Ativo', 'Inativo'].includes(status)) {
        return reply.status(400).send({
          success: false,
          error: 'Status inválido. Use "ativo" ou "inativo"'
        });
      }
      else{
        return reply.status(200).send({
          success:true,
          data: novoStatus
        })
      }

      // Verificar se usuário existe
      const usuarioExistente = await prisma.usuario.findUnique({
        where: { id: id }
      });

      if (!usuarioExistente) {
        return reply.status(404).send({
          success: false,
          error: 'Usuário não encontrado'
        });
      }

      return reply.send({
        success: true,
        message: `Status do usuário alterado para ${status}`,
        data: {
          id,
          status
        }
      });

    } catch (error) {
      console.error('❌ Erro ao alterar status:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }

  // Resetar senha
  async resetarSenha(request: FastifyRequest<{
    Params: { id: string }
  }>, reply: FastifyReply) {
    try {
      const { id } = request.params;
      // Verificar autenticação (apenas ADMIN pode resetar senha)
      const usuarioAutenticado = request.user;

      if (!usuarioAutenticado || usuarioAutenticado.tipo !== 'ADMIN') {
        return reply.status(403).send({
          success: false,
          error: 'Apenas administradores podem resetar senhas'
        });
      }

      // Verificar se usuário existe
      const usuarioExistente = await prisma.usuario.findUnique({
        where: { id: id }
      });

      if (!usuarioExistente) {
        return reply.status(404).send({
          success: false,
          error: 'Usuário não encontrado'
        });
      }

      // Gerar senha temporária
      const senhaTemporaria = Math.random().toString(36).slice(-8);
      const senhaCriptografada = await bcrypt.hash(senhaTemporaria, 10);

      // Atualizar senha
      await prisma.usuario.update({
        where: { id: id },
        data: { senhaHash: senhaCriptografada }
      });

      return reply.send({
        success: true,
        message: 'Senha resetada com sucesso',
        data: {
          novaSenha: senhaTemporaria // Em produção, envie por email
        }
      });

    } catch (error) {
      console.error('❌ Erro ao resetar senha:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }
}

export default new UsuariosController();