import { prisma } from "../config/prisma";
import { authMiddleware } from "../middleware/auth.middleware";
import { FastifyInstance } from "fastify";

export default async function servicoRoutes(app: FastifyInstance) {
  app.post("/", { preHandler: authMiddleware }, async (req) => {
    const { id, nome, preco, sku } = req.body as any;

    return prisma.produto.create({
      data: { id, nome, preco, sku }
    });
  });

  app.get("/", async () => {
    return prisma.produto.findMany({
      include: { categorias: true }
    });
  });
}
