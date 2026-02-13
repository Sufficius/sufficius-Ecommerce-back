import {prisma} from "../../lib/prisma";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { verifyPassword } from "../../services/bcrypt/verifyPassword";
import { generateToken } from "../../utils/jwt";

export const Login = async (app: FastifyInstance) => {
    app.withTypeProvider<ZodTypeProvider>().post("/auth/login", {
        schema: {
            body: z.object({
                email: z.string().email(),
                password: z.string(),
            }),
        },
    }, async (req, reply) => {
        const { email, senha } = req.body;

        // 1. Buscar usuário APENAS pelo email
        const user = await prisma.usuario.findUnique({
            where: { email, status: "ATIVO" },
        });
        if (!user) {
            return reply.status(401).send({
                success: false,
                message: "Usuário não encontrado",
                suggestion: "Verifique o email informado"
            });
        }

        const isPasswordValid = await verifyPassword(senha, user.senhaHash);

        if (!isPasswordValid) {
            return reply.status(401).send({
                success: false,
                message: "Credenciais inválidas"
            });
        }

        const token = await generateToken({
            id: user.id,
            email: user.email
        });


        const userWithoutPassword = {
            id_usuario: user.id,
            nome: user.nome,
            email: user.email,
            telefone: user.telefone,
            tipo: user.tipo,
            role: user.tipo === "ADMIN" ? "ADMIN" : "CLIENTE"
        }
        return { user: userWithoutPassword, token };
    }
    )
}