/**
 * Remove referências circulares de objetos para evitar erros de serialização
 * Versão melhorada que lida com referências circulares, buffers e objetos complexos
 */

/**
 * Verifica se um valor é um Buffer
 */
function isBuffer(value: any): boolean {
    return Buffer.isBuffer(value) || 
           (value && typeof value === 'object' && value.type === 'Buffer' && Array.isArray(value.data));
}

/**
 * Verifica se é um objeto de arquivo do multipart
 */
function isMultipartFile(obj: any): boolean {
    return obj && typeof obj === 'object' && (
        obj.type === 'file' || 
        obj.filename !== undefined || 
        obj.fieldname === 'paymentProof' ||
        obj.fieldname === 'comprovativo' ||
        obj._buf !== undefined ||
        (obj.file && typeof obj.file === 'object')
    );
}

/**
 * Extrai propriedades seguras de um objeto de arquivo
 */
function extractFileProperties(file: any): any {
    // Se já tem _buf, preservar
    const buffer = file._buf || (file.file ? file.file._buf : null);
    
    return {
        type: 'file',
        fieldname: file.fieldname || 'arquivo',
        filename: file.filename || 'arquivo.pdf',
        encoding: file.encoding || '7bit',
        mimetype: file.mimetype || 'application/octet-stream',
        _buf: buffer, // Preservar o buffer para upload
        tamanho: buffer ? buffer.length : 0
    };
}

/**
 * Remove referências circulares de objetos de forma segura
 * @param obj Objeto que pode conter referências circulares
 * @returns Objeto limpo sem referências circulares
 */
export function removeCircularReferences(obj: any): any {
    // Casos base: null, undefined, ou tipos primitivos
    if (obj === null || obj === undefined) {
        return obj;
    }
    
    if (typeof obj !== 'object') {
        return obj;
    }

    // Se for um Buffer, retornar como está (é importante para upload)
    if (isBuffer(obj)) {
        return obj;
    }

    // Se for um objeto de arquivo do multipart, extrair apenas propriedades importantes
    if (isMultipartFile(obj)) {
        return extractFileProperties(obj);
    }

    // Se for um array, processar cada item
    if (Array.isArray(obj)) {
        return obj.map(item => removeCircularReferences(item));
    }

    // Usar WeakMap para rastrear objetos já vistos e evitar loops infinitos
    const seen = new WeakMap();
    
    const circularReplacer = () => {
        return (key: string, value: any) => {
            // Ignorar campos problemáticos que causam referência circular
            if (key === 'fields' || key === 'parent' || key === 'root' || key === 'file') {
                return '[Circular Omitted]';
            }
            
            // Tratamento especial para buffers
            if (isBuffer(value)) {
                return '[Buffer]'; // Não serializar o buffer inteiro no log
            }
            
            // Se for objeto e não for null
            if (value !== null && typeof value === 'object') {
                // Se já vimos este objeto, é referência circular
                if (seen.has(value)) {
                    return '[Circular Reference]';
                }
                // Marcar como visto
                seen.set(value, true);
            }
            return value;
        };
    };

    try {
        // Tentar converter para JSON com replacer personalizado
        return JSON.parse(JSON.stringify(obj, circularReplacer()));
    } catch (error) {
        console.warn('Erro ao remover referências circulares:', error);
        
        // Fallback: extrair apenas propriedades importantes manualmente
        return extractSafeProperties(obj);
    }
}

/**
 * Extrai propriedades seguras de um objeto ignorando referências circulares
 * Versão simplificada para fallback
 */
function extractSafeProperties(obj: any): any {
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (typeof obj !== 'object') {
        return obj;
    }

    // Se for buffer, retornar representação simplificada
    if (isBuffer(obj)) {
        return '[Buffer]';
    }

    // Se for array, processar cada elemento
    if (Array.isArray(obj)) {
        return obj.map(item => extractSafeProperties(item));
    }

    // Se for objeto de arquivo
    if (isMultipartFile(obj)) {
        return {
            type: 'file',
            fieldname: obj.fieldname || 'arquivo',
            filename: obj.filename || 'arquivo',
            mimetype: obj.mimetype || 'application/octet-stream',
            hasBuffer: !!(obj._buf || (obj.file && obj.file._buf))
        };
    }

    // Objeto normal - extrair propriedades
    const safeObj: any = {};
    const processedKeys = new Set();
    
    for (const key of Object.keys(obj)) {
        // Pular propriedades problemáticas
        if (key === 'fields' || key === 'parent' || key === 'root' || key === 'file') {
            safeObj[key] = '[Omitted]';
            continue;
        }

        // Evitar processamento recursivo infinito
        if (processedKeys.has(key)) {
            safeObj[key] = '[Already Processed]';
            continue;
        }

        try {
            const value = obj[key];
            
            // Adicionar à lista de processados
            processedKeys.add(key);
            
            // Processar valor recursivamente
            safeObj[key] = extractSafeProperties(value);
            
            // Remover da lista após processamento
            processedKeys.delete(key);
            
        } catch (e) {
            safeObj[key] = '[Error]';
        }
    }

    return safeObj;
}

/**
 * Função específica para simplificar o body do multipart
 * Esta é a função principal que deve ser usada no getFieldsAndFiles
 */
export function simplifyMultipartBody(body: any): { fields: Record<string, string>, files: Record<string, any> } {
    const fields: Record<string, string> = {};
    const files: Record<string, any> = {};

    // Verificação inicial
    if (!body || typeof body !== 'object') {
        console.warn('⚠️ simplifyMultipartBody: body inválido', body);
        return { fields, files };
    }

    console.log('🔍 simplifyMultipartBody: processando body com chaves:', Object.keys(body));

    // Iterar sobre as propriedades do body
    for (const [key, value] of Object.entries(body)) {
        if (!value || typeof value !== 'object') {
            // Se for valor simples, adicionar como campo
            if (value !== undefined && value !== null) {
                fields[key] = String(value);
            }
            continue;
        }

        const obj = value as any;
        
        // Verificar se é um campo de formulário (type='field')
        if (obj.type === 'field' && obj.value !== undefined) {
            fields[key] = String(obj.value);
            console.log(`📝 Campo detectado: ${key} = ${fields[key]}`);
        }
        // Verificar se é um arquivo (type='file' ou tem filename)
        else if (obj.type === 'file' || obj.filename !== undefined || obj.fieldname === 'paymentProof' || obj.fieldname === 'comprovativo') {
            // Extrair o buffer corretamente
            let buffer = obj._buf;
            
            // Se não tem _buf direto, pode estar em obj.file._buf
            if (!buffer && obj.file && obj.file._buf) {
                buffer = obj.file._buf;
            }
            
            files[key] = {
                type: 'file',
                fieldname: obj.fieldname || key,
                filename: obj.filename || 'arquivo.pdf',
                encoding: obj.encoding || '7bit',
                mimetype: obj.mimetype || 'application/octet-stream',
                _buf: buffer, // Preservar o buffer para upload
                tamanho: buffer ? buffer.length : 0
            };
            
            console.log(`📎 Arquivo processado: ${key} = ${files[key].filename} (${files[key].tamanho} bytes)`);
        }
        // Outros tipos de objeto - tentar extrair valor
        else {
            // Pode ser um objeto aninhado
            try {
                if (obj.value !== undefined) {
                    fields[key] = String(obj.value);
                } else {
                    // Objeto complexo, tentar stringificar
                    fields[key] = JSON.stringify(obj);
                }
            } catch (e) {
                fields[key] = '[Objeto complexo]';
            }
        }
    }

    return { fields, files };
}

/**
 * Função para extrair buffer de um arquivo multipart
 * Útil se precisar processar o arquivo depois
 */
export function extractFileBuffer(fileObj: any): Buffer | null {
    if (!fileObj) return null;
    
    // Verificar se tem _buf diretamente
    if (fileObj._buf && Buffer.isBuffer(fileObj._buf)) {
        return fileObj._buf;
    }
    
    // Verificar se tem file._buf
    if (fileObj.file && fileObj.file._buf && Buffer.isBuffer(fileObj.file._buf)) {
        return fileObj.file._buf;
    }
    
    // Se não encontrou buffer
    return null;
}