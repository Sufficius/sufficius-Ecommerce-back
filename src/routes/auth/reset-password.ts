import {prisma} from "../../lib/prisma";
import { hashPassword } from "../../utils/hash";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export const ResetPass = async (app: FastifyInstance) => {
    app.withTypeProvider<ZodTypeProvider>().post('/auth/reset-password', {
        schema: {
            body: z.object({
                code: z.string().length(6), // Expect a 6-digit code
                password: z.string().min(8),
            })
        }
    }, async (request, reply) => {
        const { code, password } = request.body;

        const user = await prisma.usuario.findFirst({ where: { resetToken: code } });

        if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
            return reply.code(400).send({ error: 'Código inválido ou expirado.' });
        }

        const hashedPassword = await hashPassword(password);

        const isUpdated = await prisma.usuario.update({
            where: { id: user.id },
            data: {
                senhaHash: hashedPassword,
                resetToken: null,
                resetTokenExpiry: null
            }
        });

        if (!isUpdated) {
            return reply.code(500).send({ error: 'Erro ao atualizar a senha.' });
        }

        return reply.send({ message: 'Senha redefinida com sucesso.' });
    });
}