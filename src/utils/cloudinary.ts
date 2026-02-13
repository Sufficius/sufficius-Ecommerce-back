import { prisma } from "../config/prisma";


export function getProductImageUrl(
  publicId: string | null,
  options: {
    width?: number;
    height?: number;
    quality?: string;
    crop?: string;
    format?: string;
    fetchFormat?: string;
  } = {}
): string | null {
  if (!publicId) return null;

  // Se o publicId já for uma URL completa, retornar como está
  if (publicId.startsWith('http')) {
    console.log('⚠️  PublicId já é uma URL, retornando como está');
    return publicId;
  }

  // Configurações padrão
  const defaultOptions = {
    width: 600,
    height: 600,
    crop: 'fill' as const,
    quality: 'auto:good',
    fetchFormat: 'auto' as const
  };

  const transformOptions = { ...defaultOptions, ...options };

  // Construir transformações no formato CORRETO do Cloudinary
  const transformations: string[] = [];

  // Ordem IMPORTANTE para o Cloudinary
  if (transformOptions.crop) transformations.push(`c_${transformOptions.crop}`);
  if (transformOptions.width) transformations.push(`w_${transformOptions.width}`);
  if (transformOptions.height) transformations.push(`h_${transformOptions.height}`);
  if (transformOptions.quality) transformations.push(`q_${transformOptions.quality}`);
  if (transformOptions.fetchFormat) transformations.push(`f_${transformOptions.fetchFormat}`);

  const transformationString = transformations.join(',');

  // Construir URL CORRETA do Cloudinary
  let url: string;

  if (transformationString) {
    url = `/upload/${transformationString}/${publicId}`;
  } else {
    url = `/upload/${publicId}`;
  }

  console.log('✅ URL gerada:', url);
  return url;
}

// Função para extrair public_id de uma URL do Cloudinary
export function extractPublicIdFromUrl(url: string): string | null {
  try {
    console.log('🔍 Extraindo publicId de:', url);
    const parts = url.split('/upload/');
    if (parts.length < 2) {
      console.log('❌ Não é uma URL do Cloudinary válida');
      return null;
    }

    const afterUpload = parts[1];

    // Remover transformações se existirem (f_auto,q_auto, etc.)
    let publicIdWithVersion = afterUpload;
    if (afterUpload.includes('/v')) {
      const versionIndex = afterUpload.indexOf('/v');
      publicIdWithVersion = afterUpload.substring(versionIndex + 1);
    }

    // Remover extensão do arquivo
    const withoutExtension = publicIdWithVersion.replace(/\.[^/.]+$/, '');

    console.log('✅ PublicId extraído:', withoutExtension);
    return withoutExtension;

  } catch (error) {
    console.error('❌ Erro ao extrair public_id:', error);
    return null;
  }
}

// Gerar múltiplas URLs para o mesmo produto (diferentes tamanhos)
export function getProductImageUrls(publicId: string | null) {
  if (!publicId) return null;

  return {
    // Thumbnail pequena (para listagens)
    thumbnail: getProductImageUrl(publicId, {
      width: 150,
      height: 150,
      crop: 'fill',
      quality: 'auto:low'
    }),

    // Tamanho médio (para cards)
    medium: getProductImageUrl(publicId, {
      width: 400,
      height: 400,
      crop: 'fill',
      quality: 'auto:good'
    }),

    // Tamanho grande (para página do produto)
    large: getProductImageUrl(publicId, {
      width: 800,
      height: 800,
      crop: 'fill',
      quality: 'auto:best'
    }),

    // Original (sem transformações)
    original: `/upload/${publicId}`,

    // Para otimização web
    webp: getProductImageUrl(publicId, {
      width: 600,
      height: 600,
      crop: 'fill',
      quality: 'auto:good',
      fetchFormat: 'webp'
    })
  };
}

// Fallback dinâmico - NÃO usar sempre a mesma imagem!
export function getFallbackImage(publicId: string): string {
  // Você pode ter um array de imagens fallback

  const fallbackImages = [
    `/uploads/${publicId}`
  ];

  // Escolher aleatoriamente ou sequencialmente
  const randomIndex = Math.floor(Math.random() * fallbackImages.length);
  const fallbackPath = fallbackImages[randomIndex];

  return `${fallbackPath}`;
}

// Constante para compatibilidade (evitar quebrar código existente)
export const FALLBACK_PRODUCT_IMAGE = getFallbackImage("");

// Função para migrar URLs antigas para o novo formato
export function migrateOldUrl(oldUrl: string): string | null {
  console.log('🔄 Migrando URL antiga:', oldUrl);


  // Se for apenas um filename, tentar extrair informações
  if (oldUrl.includes('prod_') && oldUrl.includes('.jpg')) {
    console.log('⚠️  URL antiga (apenas filename):', oldUrl);

    // Tentar extrair informações do filename
    // Exemplo: prod_1768821016337_3ef9b9be-1768821016378-yu1yvntppae.jpg
    const match = oldUrl.match(/prod_([^_]+)_([^-]+)-(\d+)-([a-z0-9]+)\.jpg/);

    if (match) {
      const [, produtoId, , timestamp, random] = match;
      const newPublicId = `${produtoId}_${timestamp}_${random}`;

      console.log('✅ Gerado novo publicId:', newPublicId);
      return getProductImageUrl(newPublicId);
    }
  }

  // Não conseguiu migrar
  console.log('❌ Não foi possível migrar a URL');
  return null;
}