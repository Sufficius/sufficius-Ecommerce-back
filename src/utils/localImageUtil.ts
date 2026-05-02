import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';

const UPLOADS_DIR = process.env.UPLOADS_DIR || 'public/uploads';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

interface ImageOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png';
}

export async function ensureUploadsDir() {
  try {
    await fs.access(UPLOADS_DIR);
  } catch {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
  }
}

export function getImageUrl(
  filename: string | null | undefined,
  options: ImageOptions = {}
): string | null {
  if (!filename) return null;

  if (filename.startsWith('http')) {
    return filename;
  }

  const cleanFilename = filename.replace(/^public\//, '');

  let url = `${BASE_URL}/${cleanFilename}`;

  const params = new URLSearchParams();
  if (options.width) params.append('w', options.width.toString());
  if (options.height) params.append('h', options.height.toString());
  if (options.quality) params.append('q', options.quality.toString());
  if (options.format) params.append('format', options.format);

  const queryString = params.toString();
  if (queryString) {
    url += `?${queryString}`;
  }

  return url;
}

export function getLocalImageUrl(filename: string | null): string | null {
  if (!filename) return null;

  if (filename.startsWith('http')) {
    return filename; 
  }

  if (filename.startsWith('uploads/')) {
    return `${BASE_URL}/${filename}`;
  }

  if (filename.startsWith('/uploads/')) {
    return `${BASE_URL}${filename}`;
  }

  if (!filename.includes('/')) {
    return `${BASE_URL}/uploads/${filename}`;
  }

  return `${BASE_URL}/${filename.replace(/^\//, '')}`;
}

export async function saveImage(
  file: File | Buffer,
  originalFilename?: string
): Promise<string> {
  await ensureUploadsDir();

  const extension = originalFilename?.split('.').pop() || 'jpg';
  const filename = `${randomUUID()}.${extension}`;
  const filepath = path.join(UPLOADS_DIR, filename);

  if (file instanceof File) {
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filepath, buffer);
  } else {
    await fs.writeFile(filepath, file);
  }

  return `/uploads/${filename}`;
}

export async function deleteImage(filename: string): Promise<boolean> {
  try {
    const filepath = path.join(UPLOADS_DIR, filename.replace(/^\/uploads\//, ''));
    await fs.unlink(filepath);
    return true;
  } catch (error) {
    console.error('Erro ao deletar imagem:', error);
    return false;
  }
}

export function getImageUrls(filename: string | null) {
  if (!filename) return null;

  return {
    thumbnail: getImageUrl(filename, { width: 150, height: 150, quality: 80 }),
    medium: getImageUrl(filename, { width: 400, height: 400, quality: 85 }),
    large: getImageUrl(filename, { width: 800, height: 800, quality: 90 }),
    original: getLocalImageUrl(filename),
  };
}

export function getFallbackImage(): string {
  const fallbackImages = [
    '/uploads/fallback-product-1.jpg',
    '/uploads/fallback-product-2.jpg',
    '/uploads/fallback-product-3.jpg',
  ];

  const randomIndex = Math.floor(Math.random() * fallbackImages.length);
  return `${BASE_URL}${fallbackImages[randomIndex]}`;
}