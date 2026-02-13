import {prisma} from "../../lib/prisma";
import { sendResetCodeEmail } from "../../services/nodemailer";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export const ForgotPass = async (app: FastifyInstance) => {
    app.withTypeProvider<ZodTypeProvider>().post('/auth/forgot-password', {
        schema: {
            body: z.object({
                email: z.string().email(),
            })
        }
    }, async (request, reply) => {
        const { email } = request.body;
        const user = await prisma.usuario.findUnique({ where: { email } });

        if (user) {
            const resetCode = Math.floor(100000 + Math.random() * 900000).toString(); // Generate 6-digit code
            const expiry = new Date(Date.now() + 3600_000); // 1 hour

            await prisma.usuario.update({
                where: { email },
                data: { resetToken: resetCode, resetTokenExpiry: expiry }
            });

            await sendResetCodeEmail(email, resetCode);
        }
        return reply.code(200).send({ message: 'Se existe conta, código enviado por e-mail.' });
    });
}