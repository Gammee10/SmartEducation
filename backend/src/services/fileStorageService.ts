// Cloudinary file storage service - handles uploads for learning materials.
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import env from '../config/env';
import { AppError, ValidationError } from '../utils/errors';

interface UploadFile {
  path?: string;
  buffer?: Buffer;
  mimetype: string;
  size: number;
}

cloudinary.config({
  cloud_name: env.cloudinaryCloudName,
  api_key: env.cloudinaryApiKey,
  api_secret: env.cloudinaryApiSecret,
});

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB - documents only; content upload is URL-based

// Bound concurrent upload memory: buffered uploads are held in RAM (and were
// historically base64-doubled at ~2.3x). Disk-backed uploads stream from
// disk, but a small semaphore still stops a burst of parallel uploads from
// exhausting file descriptors and outbound bandwidth.
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
// accepted based on the declared type plus an active-markup scan (below).
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

// --- Text upload hardening (M10) -----------------------------------------
// text/plain and text/csv have no magic bytes, so a `.html` renamed to
// `.txt` would previously sail through and become stored XSS if ever served
// inline. Uploads are linked as downloads (never rendered inline), but
// defense in depth rejects documents that are actually markup: a leading
// markup tag, or any embedded <script>/<iframe>/<object>/<embed>.
const LEADING_MARKUP_RE = /^\s*(?:\uFEFF)?<(html|head|body|script|iframe|object|embed|link|meta|style|svg|math|frameset)[\s>]/i;
const EMBEDDED_ACTIVE_RE = /<(script|iframe|object|embed)[\s>]/i;

function containsActiveMarkup(text: string): boolean {
  return LEADING_MARKUP_RE.test(text) || EMBEDDED_ACTIVE_RE.test(text);
}

function assertTextSafe(head: Buffer, mimeType: string): void {
  if (mimeType !== 'text/plain' && mimeType !== 'text/csv') return;
  const text = head.subarray(0, 8192).toString('utf8');
  if (containsActiveMarkup(text)) {
    throw new ValidationError(
      'Text files must not contain HTML markup or scripts - save the document as plain text and retry'
    );
  }
}

// Read only the head of a disk-backed upload for validation so a 20MB file
// is never fully buffered for sniffing.
function readHead(filePath: string, bytes: number): Buffer {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(bytes);
    const read = fs.readSync(fd, buf, 0, bytes, 0);
    return buf.subarray(0, read);
  } finally {
    fs.closeSync(fd);
  }
}

// Virus-scan hook point (M10): plug a scanner (e.g. ClamAV) here. Runs after
// type validation and before the Cloudinary upload; a rejection aborts the
// upload. Currently a documented no-op so the pipeline shape is fixed.
async function scanFileHook(_file: UploadFile): Promise<void> {
  return;
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

  // Validate content before spending bandwidth: magic bytes for binary
  // formats (from the buffer or the disk head), markup scan for text.
  // Disk-backed uploads never fully enter RAM for validation.
  const head: Buffer | null = file.buffer
    ? file.buffer.subarray(0, 8192)
    : file.path
      ? readHead(file.path, 8192)
      : null;
  if (!head || !bufferMatchesDeclaredType(head, file.mimetype)) {
    throw new ValidationError('File content does not match its declared type');
  }
  assertTextSafe(head, file.mimetype);
  await scanFileHook(file);

  activeUploads++;
  try {
    // Disk-backed uploads stream from disk (no base64 RAM doubling);
    // in-memory buffers keep the legacy data-URI path.
    const source = file.path || `data:${file.mimetype};base64,${file.buffer!.toString('base64')}`;
    const result = await cloudinary.uploader.upload(source, {
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
  } finally {
    activeUploads--;
    // Multer disk files are temp artifacts - always clean up, even when the
    // upload itself failed (pairs with the H4 DB-failure compensation).
    if (file.path) {
      fs.promises.unlink(file.path).catch(() => undefined);
    }
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

export { uploadFile, deleteFile, getContentType, isConfigured, containsActiveMarkup };
