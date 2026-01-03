import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// Tipos para as requisições
interface CriarUsuarioBody {
  nome: string;
  email: string;
  senha: string;
  telefone?: string;
  tipo?: string;
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
}

interface ListarUsuariosQuery {
  pagina?: string;
  limite?: string;
  busca?: string;
}

export class UsuariosController {
  // Criar novo usuário
  async criarUsuario(request: FastifyRequest<{ Body: CriarUsuarioBody }>, reply: FastifyReply) {
    try {
      const {nome, email, senha, telefone } = request.body;

      const {id} = request.params as any;

      // Validação básica
      if (!nome || !email || !senha) {
        return reply.status(400).send({
          erro: 'Nome, email e senha são obrigatórios'
        });
      }

      // Verificar se email já existe
      const usuarioExistente = await prisma.usuario.findUnique({
        where: { email }
      });

      if (usuarioExistente) {
        return reply.status(409).send({
          erro: 'Email já cadastrado'
        });
      }

      // Criptografar senha
      const senhaCriptografada = await bcrypt.hash(senha, 10);

      // Criar usuário
      const novoUsuario = await prisma.usuario.create({
        data: {
          nome,
          email,
          senhaHash: senhaCriptografada,
          telefone: telefone ?? "",
          tipo: "CLIENTE",
          id: id
        },
        select: {
          id: true,
          nome: true,
          email: true,
          telefone: true,
          tipo: true,
          criadoEm: true,
          atualizadoEm: true
        }
      });

      return reply.status(201).send({
        mensagem: 'Usuário criado com sucesso',
        usuario: novoUsuario
      });

    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      return reply.status(500).send({
        erro: 'Erro interno do servidor'
      });
    }
  }

  // Listar todos os usuários (com paginação)
  async listarUsuarios(request: FastifyRequest<{ Querystring: ListarUsuariosQuery }>, reply: FastifyReply) {
    try {
      const { pagina = '1', limite = '10', busca } = request.query;
      const skip = (Number(pagina) - 1) * Number(limite);

      // Construir condições de busca
      const whereClause: any = {};
      if (busca) {
        whereClause.OR = [
          { nome: { contains: busca, mode: 'insensitive' } },
          { email: { contains: busca, mode: 'insensitive' } }
        ];
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
            criadoEm: true,
            atualizadoEm: true
          },
          skip,
          take: Number(limite),
          orderBy: { criadoEm: 'desc' }
        }),
        prisma.usuario.count({ where: whereClause })
      ]);

      return reply.send({
        usuarios,
        paginacao: {
          pagina: Number(pagina),
          limite: Number(limite),
          total,
          totalPaginas: Math.ceil(total / Number(limite))
        }
      });

    } catch (error) {
      console.error('Erro ao listar usuários:', error);
      return reply.status(500).send({
        erro: 'Erro interno do servidor'
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
          criadoEm: true,
          atualizadoEm: true
        }
      });

      if (!usuario) {
        return reply.status(404).send({
          erro: 'Usuário não encontrado'
        });
      }

      return reply.send(usuario);

    } catch (error) {
      console.error('Erro ao obter usuário:', error);
      return reply.status(500).send({
        erro: 'Erro interno do servidor'
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
      const { nome, email, telefone, senha, tipo } = request.body;
      const usuarioId = id;

      // Verificar se usuário existe
      const usuarioExistente = await prisma.usuario.findUnique({
        where: { id: usuarioId }
      });

      if (!usuarioExistente) {
        return reply.status(404).send({
          erro: 'Usuário não encontrado'
        });
      }

      // Preparar dados para atualização
      const dadosAtualizacao: any = {};
      
      if (nome) dadosAtualizacao.nome = nome;
      if (telefone) dadosAtualizacao.telefone = telefone;
      if (tipo) dadosAtualizacao.tipo = tipo;
      
      // Verificar se email já existe (se estiver sendo alterado)
      if (email && email !== usuarioExistente.email) {
        const emailExistente = await prisma.usuario.findUnique({
          where: { email }
        });
        
        if (emailExistente) {
          return reply.status(409).send({
            erro: 'Email já está em uso por outro usuário'
          });
        }
        dadosAtualizacao.email = email;
      }

      // Se houver senha, criptografar
      if (senha) {
        dadosAtualizacao.senha = await bcrypt.hash(senha, 10);
      }

      // Atualizar usuário
      const usuarioAtualizado = await prisma.usuario.update({
        where: { id: usuarioId },
        data: dadosAtualizacao,
        select: {
          id: true,
          nome: true,
          email: true,
          telefone: true,
          tipo: true,
          criadoEm: true,
          atualizadoEm: true
        }
      });

      return reply.send({
        mensagem: 'Usuário atualizado com sucesso',
        usuario: usuarioAtualizado
      });

    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      return reply.status(500).send({
        erro: 'Erro interno do servidor'
      });
    }
  }

  // Deletar usuário
  async deletarUsuario(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    try {
      const { id } = request.params;
      const usuarioId = id;

      // Verificar se usuário existe
      const usuarioExistente = await prisma.usuario.findUnique({
        where: { id: usuarioId }
      });

      if (!usuarioExistente) {
        return reply.status(404).send({
          erro: 'Usuário não encontrado'
        });
      }

      // Deletar usuário
      await prisma.usuario.delete({
        where: { id: usuarioId }
      });

      return reply.send({
        mensagem: 'Usuário deletado com sucesso'
      });

    } catch (error) {
      console.error('Erro ao deletar usuário:', error);
      return reply.status(500).send({
        erro: 'Erro interno do servidor'
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
          erro: 'Email e senha são obrigatórios'
        });
      }

      // Buscar usuário
      const usuario = await prisma.usuario.findUnique({
        where: { email }
      });

      if (!usuario) {
        return reply.status(401).send({
          erro: 'Credenciais inválidas'
        });
      }

      // Verificar senha
      const senhaValida = await bcrypt.compare(senha, usuario.senhaHash);

      if (!senhaValida) {
        return reply.status(401).send({
          erro: 'Credenciais inválidas'
        });
      }

      // Gerar token JWT
      const token = jwt.sign(
        {
          id: usuario.id,
          email: usuario.email,
          tipo: usuario.tipo
        },
        process.env.JWT_SECRET || 'seu_segredo_jwt',
        { expiresIn: '24h' }
      );

      return reply.send({
        mensagem: 'Login realizado com sucesso',
        token,
        usuario: {
          id: usuario.id,
          nome: usuario.nome,
          email: usuario.email,
          tipo: usuario.tipo
        }
      });

    } catch (error) {
      console.error('Erro ao fazer login:', error);
      return reply.status(500).send({
        erro: 'Erro interno do servidor'
      });
    }
  }

  // Obter perfil do usuário autenticado
  async obterPerfil(request: FastifyRequest, reply: FastifyReply) {
    try {
      // O ID do usuário vem do hook de autenticação
      const usuarioId = (request as any).usuarioId;

      const usuario = await prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: {
          id: true,
          nome: true,
          email: true,
          telefone: true,
          tipo: true,
          criadoEm: true,
          atualizadoEm: true
        }
      });

      if (!usuario) {
        return reply.status(404).send({
          erro: 'Usuário não encontrado'
        });
      }

      return reply.send(usuario);

    } catch (error) {
      console.error('Erro ao obter perfil:', error);
      return reply.status(500).send({
        erro: 'Erro interno do servidor'
      });
    }
  }
}

export default new UsuariosController();