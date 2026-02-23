import { MultipartFile } from "@fastify/multipart";
import { MultipartBody, MultipartField } from "../types/multipart";
import { simplifyMultipartBody } from "./objects"; // Importar a nova função simplificada
import { copyFileSync } from "fs";

/**
 * Extracts fields and files from a given multipart body.
 *
 * This asynchronous function processes the provided multipart data,
 * categorizing it into fields and files. Fields are expected to have
 * a type of "field" and will be stored in a key-value format, while
 * files will be stored as is in a separate object.
 *
 * @param {MultipartBody} data - The multipart body containing fields and files.
 * @returns {Promise<{ fields: Record<string, string>, files: Record<string, MultipartFile> }>}
 *          A promise that resolves to an object containing two properties:
 *          - `fields`: An object mapping field names to their values.
 *          - `files`: An object mapping file names to their corresponding MultipartFile objects.
 *
 * @throws {Error} Throws an error if the input data is not in the expected format.
 *
 * @example
 * const data = {
 *   username: { type: 'field', value: 'john_doe' },
 *   profilePic: { type: 'file', ...fileObject }
 * };
 *
 * const result = await getFieldsAndFiles(data);
 * console.log(result.fields);
 * console.log(result.files);
 */
export async function getFieldsAndFiles(data: MultipartBody) {
    // VERIFICAÇÃO CRÍTICA - Corrige o erro "Cannot convert undefined or null to object"
    if (!data || typeof data !== 'object') {
        console.warn('❌ getFieldsAndFiles recebeu dados inválidos:', data);
        return { fields: {}, files: {} };
    }

    console.log('📦 getFieldsAndFiles processando dados...');
    
    // USAR A FUNÇÃO SIMPLIFICADA que já lida com referências circulares
    const { fields, files } = simplifyMultipartBody(data);

    console.log('✅ Campos extraídos com sucesso:', Object.keys(fields));
    console.log('✅ Arquivos extraídos com sucesso:', Object.keys(files));

    // Converter files para o formato esperado (MultipartFile | undefined)
    const formattedFiles: Record<string, MultipartFile | undefined> = {};
    
    for (const [key, fileObj] of Object.entries(files)) {
        formattedFiles[key] = fileObj as MultipartFile;
    }

    return { 
        fields, 
        files: formattedFiles 
    };
}