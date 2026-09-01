// Cloudinary file storage service - handles uploads for learning materials.
import { v2 as cloudinary } from 'cloudinary';
import env from '../config/env';
import { AppError, ValidationError } from '../utils/errors';

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

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB - documents only; content upload is URL-based

// Bound concurrent upload memory: each buffered upload is held in RAM and
// base64-doubled (roughly 2.3x file size). A small semaphore stops a handful
// of parallel uploads from exhausting the Node heap.
const MAX_CONCURRENT_UPLOADS = 5;
let activeUploads = 0;

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

// --- Magic-byte sniffing -------------------------------------------------
// The client-supplied Content-Type is not trustworthy; a .exe renamed to
// .pdf must be rejected. Text formats have no magic bytes, so they are
// accepted based on the declared type.
const isZip = (b: Buffer) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
const isOle = (b: Buffer) => b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0;

const MAGIC_SIGNATURES: Array<{ mimeType: string; check: (b: Buffer) => boolean }> = [
  { mimeType: 'application/pdf', check: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-' },
  { mimeType: 'image/png', check: (b) => b.subarray(0, 4).toString('latin1') === '\x89PNG' },
  { mimeType: 'image/jpeg', check: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mimeType: 'image/gif', check: (b) => b.subarray(0, 4).toString('latin1') === 'GIF8' },
  {
    mimeType: 'image/webp',
    check: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
  },
  { mimeType: 'application/zip', check: isZip },
  // OOXML office documents are ZIP containers
  { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', check: isZip },
  { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', check: isZip },
  { mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', check: isZip },
  // Legacy Office binary formats are OLE2 compound files
  { mimeType: 'application/msword', check: isOle },
  { mimeType: 'application/vnd.ms-excel', check: isOle },
  { mimeType: 'application/vnd.ms-powerpoint', check: isOle },
  { mimeType: 'text/plain', check: () => true },
  { mimeType: 'text/csv', check: () => true },
];

function bufferMatchesDeclaredType(buffer: Buffer, mimeType: string): boolean {
  const signature = MAGIC_SIGNATURES.find((s) => s.mimeType === mimeType);
  if (!signature) return false;
  return signature.check(buffer);
}

async function uploadFile(file: UploadFile, folder = 'course-content'): Promise<UploadResult> {
  if (!isConfigured()) {
    throw new ValidationError('Cloudinary is not configured');
  }
  if (!file) {
    throw new ValidationError('No file provided');
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new ValidationError('File size exceeds the 20MB limit');
  }
  if (activeUploads >= MAX_CONCURRENT_UPLOADS) {
    throw new AppError('Too many uploads in progress, please retry shortly', 503);
  }

  if (file.buffer && !bufferMatchesDeclaredType(file.buffer, file.mimetype)) {
    throw new ValidationError('File content does not match its declared type');
  }

  activeUploads++;
  try {
    const result = await cloudinary.uploader.upload(
      file.path || `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
      {
        folder,
        resource_type: 'auto',
        use_filename: true,
        unique_filename: true,
      }
    );

    return {
      url: result.secure_url,
      publicId: result.public_id,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    };
  } finally {
    activeUploads--;
  }
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