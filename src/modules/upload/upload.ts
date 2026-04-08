import { FastifyInstance, FastifyRequest } from "fastify";
import { createWriteStream } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { pipeline } from "stream/promises";
import { mkdir } from "fs/promises";
import { supabase } from "../../lib/supabase";

interface UploadRequest {
  Body: {
    imagem: any; // Multipart file
  };
}

const normalizeFileName = (filename: string): string => {
  if (!filename) return `file_${randomUUID()}`;
  return filename
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
};

export default async function uploadRoutes(app: FastifyInstance) {

  // Rota para upload de imagem LOCAL
  app.post("/", async (request: FastifyRequest<UploadRequest>, reply) => {
    try {
      // ✅ CORREÇÃO: Verificar autenticação com jwtVerify
      try {
        await request.jwtVerify();
      } catch (err) {
        console.log("🍀🍀🍀🍀🍀 Usuário não autorizado!");
        return reply.status(401).send({
          success: false,
          message: "Não autorizado. Token inválido ou expirado."
        });
      }

      // ✅ Verificar se é ADMIN (opcional)
      const user = request.user as any;
      if (user.tipo !== 'ADMIN') {
        return reply.status(403).send({
          success: false,
          message: "Acesso negado. Apenas administradores podem fazer upload."
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

      console.log(`✅ Upload local realizado: ${imageUrl} por ${user.email}`);

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

  // Rota para upload no Supabase
  app.post("/supabase", async (request: FastifyRequest<UploadRequest>, reply) => {
    try {

      console.log("📨 Content-Type:", request.headers['content-type']);
      // ✅ CORREÇÃO: Verificar autenticação com jwtVerify

      await request.jwtVerify();
      const user = request.user as any;

      console.log("👤 Usuário autenticado:", user.email);
      const parts = request.parts();
      let fileData: any = null;

      for await (const part of parts) {
        if (part.type === 'file') {
          // É um arquivo
          console.log("📁 Arquivo encontrado:", part.fieldname, part.filename);
          fileData = part;
          break;
        } else {
          // É um campo de texto
          console.log("📝 Campo de texto:", part.fieldname, part.value);
        }
      }

      if (!fileData) {
        console.log("❌ Nenhum arquivo encontrado nos parts");
        return reply.status(400).send({
          success: false,
          message: "Nenhum arquivo enviado. O campo deve ser 'imagem'"
        });
      }

      // ✅ Verificar se é ADMIN (opcional)
      if (user.tipo !== 'ADMIN') {
        return reply.status(403).send({
          success: false,
          message: "Acesso negado. Apenas administradores podem fazer upload."
        });
      }

      const data = fileData;

      console.log("📁 Dados do arquivo recebido:", {
        hasFile: !!data,
        filename: data?.filename,
        mimetype: data?.mimetype,
        bytesRead: data?.file.bytesRead,
        fields: data?.fields ? Object.keys(data.fields) : []
      });

      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!validTypes.includes(data.mimetype)) {
        return reply.status(400).send({
          success: false,
          message: "Tipo de arquivo não suportado. Use JPEG, PNG ou WebP"
        });
      }

      // Converter para buffer
      const buffer = await data.toBuffer();


      if (buffer.length > 10 * 1024 * 1024) {
        return reply.status(400).send({
          success: false,
          message: "Arquivo muito grande. Máximo 10MB"
        });
      }

      const originalName = data.filename;
      const normalizedName = normalizeFileName(originalName);
      const fileName = `${randomUUID()}_${normalizedName}`;

      const bucket = 'produtos-imagens';
      const filePath = `uploads/${fileName}`;

      console.log("📁 Uploading to Supabase:",
        { bucket, filePath, size: buffer.length, mimetype: data.mimetype, user: user.email }
      );

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, buffer, {
          contentType: data.mimetype,
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error("❌ Supabase upload error:", uploadError);
        return reply.status(500).send({
          success: false,
          message: "Erro ao fazer upload para Supabase",
          error: uploadError.message
        });
      }

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);

      console.log(`✅ Upload Supabase realizado: ${urlData.publicUrl} por ${user.email}`);

      return reply.status(200).send({
        success: true,
        filename: fileName,
        url: urlData.publicUrl,
        message: "Upload para Supabase realizado com sucesso"
      });

    } catch (error) {
      console.error("❌ Erro no upload para Supabase:", error);
      return reply.status(500).send({
        success: false,
        message: "Erro interno no servidor"
      });
    }
  });

  // Rota para deletar imagem
  app.delete("/:filename", async (request, reply) => {
    try {
      // ✅ Verificar autenticação
      let user;
      try {
        await request.jwtVerify();
        user = request.user as any;
      } catch (err) {
        return reply.status(401).send({
          success: false,
          message: "Não autorizado. Token inválido ou expirado."
        });
      }

      // ✅ Verificar se é ADMIN
      if (user.tipo !== 'ADMIN') {
        return reply.status(403).send({
          success: false,
          message: "Acesso negado. Apenas administradores podem deletar imagens."
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

      // Deletar do Supabase também (opcional)
      const bucket = 'produtos-imagens';
      const filePath = `uploads/${filename}`;

      const { error: deleteError } = await supabase.storage
        .from(bucket)
        .remove([filePath]);

      if (deleteError) {
        console.error("❌ Erro ao deletar do Supabase:", deleteError);
        // Continua mesmo com erro
      }

      // Deletar local
      const { unlink } = require('fs/promises');
      const filePathLocal = join(__dirname, '../../../uploads/', filename);

      try {
        await unlink(filePathLocal);
      } catch (error) {
        // Arquivo não existe, ignorar erro
      }

      console.log(`✅ Imagem deletada: ${filename} por ${user.email}`);

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