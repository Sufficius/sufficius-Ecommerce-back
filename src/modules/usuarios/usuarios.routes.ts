import { FastifyInstance } from 'fastify';
import {UsuariosController} from './usuarios.controller';

const usuariosController = new UsuariosController();

export default async function usuariosRoutes(fastify: FastifyInstance) {
  // Rotas públicas
  fastify.post('/', usuariosController.criarUsuario.bind(usuariosController));
  fastify.post('/login', usuariosController.login.bind(usuariosController));

  // Rotas protegidas por autenticação
  fastify.get('/perfil', usuariosController.obterPerfil.bind(usuariosController));

  // Rotas de CRUD
  fastify.get('/', usuariosController.listarUsuarios.bind(usuariosController));
  fastify.get('/:id', usuariosController.obterUsuarioPorId.bind(usuariosController));
  fastify.put('/:id', usuariosController.atualizarUsuario.bind(usuariosController));
  fastify.delete('/:id', usuariosController.deletarUsuario.bind(usuariosController));

  // Rotas adicionais
  fastify.put('/:id/status', usuariosController.alterarStatusUsuario.bind(usuariosController));
  fastify.post('/:id/resetar-senha', usuariosController.resetarSenha.bind(usuariosController));
}