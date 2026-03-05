import { prisma } from "../config/prisma";
import { authenticate } from "../middleware/auth.middleware";
import { FastifyInstance } from "fastify";

export default async function servicoRoutes(app: FastifyInstance) {
  app.post("/", { preHandler: authenticate }, async (req) => {
    const { id, nome, preco, sku, quantidade } = req.body as any;

    return prisma.produto.create({
      data: {
        id,
        nome,
        preco,
        quantidade,
      }
    });
  });

  app.get("/", async () => {
    return prisma.produto.findMany({
      include: { Categoria: true }
    });
  });
}
