// src/utils/cloudinary.ts
export function getProductImageUrl(
  publicId: string | null, 
  options: {
    width?: number;
    height?: number;
    quality?: string;
  } = {}
): string | null {
  if (!publicId) return null;

  const defaultOptions = {
    width: 600,
    height: 600,
    crop: 'fill',
    quality: 'auto:good'
  };

  const transformOptions = { ...defaultOptions, ...options };
  const transformations = Object.entries(transformOptions)
    .map(([key, value]) => `${key}_${value}`)
    .join(',');

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'demo';
  
  return `https://res.cloudinary.com/${cloudName}/image/upload/${transformations}/${publicId}`;
}

// Fallback para produtos sem imagem
export const FALLBACK_PRODUCT_IMAGE = 'https://res.cloudinary.com/demo/image/upload/w_600,h_600,c_fill,q_auto:good/sample.jpg';