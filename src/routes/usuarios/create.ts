import { hashPassword } from "../../utils/hash";
import { prisma } from "../../lib/prisma";
import { criarUsuarioSchema } from "../../modules/validations/usuario/criar-usuario";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";

export const criarUsuario = async (app: FastifyInstance) => {
    app.withTypeProvider<ZodTypeProvider>().post('/usuarios', {
        schema: {
            body: criarUsuarioSchema
        },
    }, async (request, reply) => {
        const { id, nome, email, senha, telefone, tipo } = request.body as any;

        if (!nome || !email || !senha) {
            return reply.status(400).send({
                success: false,
                error: 'Nome, email e senha são obrigatórios'
            });
        }

        if (senha.length < 6) {
            return reply.status(400).send({
                success: false,
                error: 'Senha deve ter pelo menos 6 caracteres'
            });
        }




        // Verificar se email ou telefone já existe
        const usuarioExistente = await prisma.usuario.findFirst({
            where: {
                OR: [
                    { email },
                    { telefone }
                ],
            },
        });

        if (usuarioExistente) {
            return reply.status(409).send({
                success: false,
                error: 'Email ou telefone já cadastrado'
            });
        }

        // Criptografar senha
        const senhaHash = await hashPassword(senha);

        // Criar usuário
        const usuario = await prisma.usuario.create({
            data: {
                id: "",
                nome,
                email: email.toLowerCase(),
                senhaHash: senhaHash,
                telefone,
                fotoUrl: null,
                status: 'ATIVO',
            },
        });

        return reply.status(201).send({
            success: true,
            message: 'Usuário criado com sucesso',
            data: usuario,
        });
    });
};