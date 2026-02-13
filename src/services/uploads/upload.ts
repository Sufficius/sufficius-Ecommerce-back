import { imageFormat } from "../../helpers/format";
import { MultipartFile } from "@fastify/multipart";
import fs from "fs";
import path from "path";
import { pipeline } from "stream";
import util from "util";

class UploadService {
    private uploadDir: string = path.join(__dirname, '../../uploads');
    private pump = util.promisify(pipeline)
    constructor() {
        this.ensureUploadDirExists();
    }

    private ensureUploadDirExists() {
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }
    }

    async saveFile(File: MultipartFile): Promise<string> {
        if (!imageFormat.includes(File.mimetype)) {
            throw new Error(`Tipo de arquivo não suportado: ${File.mimetype}`);
        }
        const filename = `${Date.now()}${File.filename}`
        const filePath = path.join(this.uploadDir, filename);
        await this.pump(File.file, fs.createWriteStream(filePath));
        return `/static/${filename}`;
    }

    async deleteImage(fotoUrl: string): Promise<string> {
        let message: string = "";
        let file = fotoUrl.replace('/static/', '')
        let filePath = `${this.uploadDir}/${file.trim()}`
        console.log(filePath)
        if (fs.existsSync(`${filePath}`)) {
            console.log(filePath)
            await fs.unlink(`${filePath}`, (error) => {
                if (error) {
                    message = error.message
                }
                else {
                    message = "Ficheiro eliminado com sucesso"
                }
            })
        }
        else {
            message = "ficheiro não encontrado"
        }
        console.log(message)
        return message
    }
}

export const uploadService = new UploadService();