import { FastifyInstance } from 'fastify';
import { UsuariosController } from './usuarios.controller';

const usuariosController = new UsuariosController();

export async function usuariosRoutes(fastify: FastifyInstance) {
  // Rotas públicas
  fastify.post(
    '/usuarios',
    usuariosController.criarUsuario
  );

  fastify.post(
    '/usuarios/login',
    usuariosController.login
  );

  // Rotas protegidas por autenticação
  fastify.get(
    '/usuarios/perfil',
    usuariosController.obterPerfil
  );

  // Rotas protegidas por autenticação e autorização (apenas admin)
  fastify.get(
    '/usuarios',
    usuariosController.listarUsuarios
  );

  fastify.get(
    '/usuarios/:id',
    usuariosController.obterUsuarioPorId
  );

  fastify.put(
    '/usuarios/:id',
    usuariosController.atualizarUsuario
  );

  fastify.delete(
    '/usuarios/:id',
    usuariosController.deletarUsuario
  );
}

// Exportando o plugin
export default usuariosRoutes;