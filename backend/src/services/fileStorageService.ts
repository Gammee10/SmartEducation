// Cloudinary file storage service - handles uploads for learning materials.
import { v2 as cloudinary } from 'cloudinary';
import env from '../config/env';
import { ValidationError } from '../utils/errors';

interface UploadFile {
  path?: string;
  buffer: Buffer;
  mimetype: string;
  size: number;
}

cloudinary.config({
  cloud_name: env.cloudinaryCloudName,
  api_key: env.cloudinaryApiKey,
  api_secret: env.cloudinaryApiSecret,
});

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

interface UploadResult {
  url: string;
  publicId: string;
  mimeType: string;
  sizeBytes: number;
}

function isConfigured(): boolean {
  return Boolean(env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret);
}

function getContentType(mimeType: string): string {
  if (mimeType.startsWith('video/')) return 'VIDEO';
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType.startsWith('text/') || mimeType.includes('document') || mimeType.includes('word')) return 'DOCUMENT';
  return 'OTHER';
}

async function uploadFile(file: UploadFile, folder = 'course-content'): Promise<UploadResult> {
  if (!isConfigured()) {
    throw new ValidationError('Cloudinary is not configured');
  }
  if (!file) {
    throw new ValidationError('No file provided');
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new ValidationError('File size exceeds the 50MB limit');
  }

  const result = await cloudinary.uploader.upload(file.path || `data:${file.mimetype};base64,${file.buffer.toString('base64')}`, {
    folder,
    resource_type: 'auto',
    use_filename: true,
    unique_filename: true,
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    mimeType: file.mimetype,
    sizeBytes: file.size,
  };
}

async function deleteFile(publicId: string): Promise<void> {
  if (!isConfigured() || !publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error('Cloudinary delete failed:', err);
  }
}

export { uploadFile, deleteFile, getContentType, isConfigured };