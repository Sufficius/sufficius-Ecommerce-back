import {prisma} from "../../lib/prisma";
import { verifyToken } from "../../utils/jwt";
import { FastifyInstance } from "fastify"
import { ZodTypeProvider } from "fastify-type-provider-zod"
import z from "zod"


export const ValidationToken = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().post('/auth/validateToken', {
    schema: {
      body: z.object({
        token: z.string(),
      })
    }
  }, async (request, reply) => {
    const { token } = request.body;

    if (!token) {
      reply.status(400).send({ error: 'Token not provided' });
      return;
    }

    const decodedToken = await verifyToken(token) as {
      id: string
    };

    if (!decodedToken) {
      reply.status(401).send({ error: 'Invalid token' });
      return;
    }

    const findUser = await prisma.usuario.findUnique({
      where: {
        id: decodedToken.id
      }
    });

    if (!findUser) {
      reply.status(400).send({ error: 'User not found' });
      return;
    }

    const userWithoutPassword = {
      id_user: findUser.id,
      name: findUser.nome,
      email: findUser.email,
      phone_number: findUser.telefone,
      avatar: findUser.fotoUrl,
    }

    reply.status(200).send({ message: 'Token is valid',user: userWithoutPassword });

  });
}