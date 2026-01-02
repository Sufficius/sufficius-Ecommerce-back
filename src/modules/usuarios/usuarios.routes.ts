import { FastifyInstance } from "fastify";
import { hashPassword, comparePassword } from "../../utils/hash";
import { prisma } from "../../config/prisma";

export default async function authRoutes(app: FastifyInstance) {
  app.post("/register", async (req, reply) => {
    const { nome, email, id, telefone, tipo, senhaHash } = req.body as any;

    const user = await prisma.usuario.create({
      data: {
        nome,
        email,
        id,
        telefone,
        tipo,
        senhaHash
      }
    });

    reply.send(user);
  });

  app.post("/login", async (req, reply) => {
    const { email, senha } = req.body as any;

    const user = await prisma.usuario.findUnique({ where: { email } });
    if (!user || !(await comparePassword(email, user.email))) {
      return reply.status(401).send({ message: "Credenciais inválidas" });
    }

    const token = app.jwt.sign({
      id: user.id
    });

    reply.send({ token, user });
  });
}
