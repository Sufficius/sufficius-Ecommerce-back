import { FastifyInstance, FastifyRequest } from "fastify";
import { createWriteStream } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import {pipeline} from "stream/promises";
import { mkdir } from "fs/promises";

interface UploadRequest {
  Body: {
    imagem: any; // Multipart file
  };
}

export default async function uploadRoutes(app: FastifyInstance) {
  // Rota para upload de imagem
  app.post("/", async (request: FastifyRequest<UploadRequest>, reply) => {
    try {
      // Verificar autenticação
      if (!request.usuario) {
        console.log("🍀🍀🍀🍀🍀Usuário não autorizado!")
        return reply.status(401).send({
          success: false,
          message: "Não autorizado"
        });
      }

      // Processar o arquivo multipart
      const data = await request.file();

      if (!data) {
        return reply.status(400).send({
          success: false,
          message: "Nenhum arquivo enviado"
        });
      }

      // Validar tipo do arquivo
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!validTypes.includes(data.mimetype)) {
        return reply.status(400).send({
          success: false,
          message: "Tipo de arquivo não suportado. Use JPEG, PNG ou WebP"
        });
      }

      // Validar tamanho (10MB)
      if (data.file.bytesRead > 10 * 1024 * 1024) {
        return reply.status(400).send({
          success: false,
          message: "Arquivo muito grande. Máximo 10MB"
        });
      }

      // Gerar nome único para o arquivo
      const fileExtension = data.filename.split('.').pop();
      const fileName = `${randomUUID()}.${fileExtension}`;
      
      // Caminho onde o arquivo será salvo
      const uploadDir = join(__dirname, '../../../uploads');
      const filePath = join(uploadDir, fileName);

      // Criar diretório se não existir
        await mkdir(uploadDir, { recursive: true });

      // Salvar o arquivo
      await pipeline(data.file, createWriteStream(filePath));

      // URL pública da imagem
      const imageUrl = `/uploads/${fileName}`;

      return reply.status(200).send({
        success: true,
        filename: fileName,
        caminho: imageUrl,
        message: "Upload realizado com sucesso"
      });

    } catch (error) {
      console.error("❌ Erro no upload:", error);
      return reply.status(500).send({
        success: false,
        message: "Erro interno no servidor"
      });
    }
  });

  // Rota para deletar imagem
  app.delete("/:filename", async (request, reply) => {
    try {
      // Verificar autenticação
      if (!request.usuario) {
        return reply.status(401).send({
          success: false,
          message: "Não autorizado"
        });
      }

      const { filename } = request.params as { filename: string };
      
      // Validar filename para evitar path traversal
      if (filename.includes('..') || filename.includes('/')) {
        return reply.status(400).send({
          success: false,
          message: "Nome de arquivo inválido"
        });
      }

      const { unlink } = require('fs/promises');
      const filePath = join(__dirname, '../../../uploads/', filename);

      try {
        await unlink(filePath);
      } catch (error) {
        // Arquivo não existe, ignorar erro
      }

      return reply.status(200).send({
        success: true,
        message: "Imagem deletada com sucesso"
      });

    } catch (error) {
      console.error("❌ Erro ao deletar imagem:", error);
      return reply.status(500).send({
        success: false,
        message: "Erro interno no servidor"
      });
    }
  });
}