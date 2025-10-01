/**
 * File validation module
 * Validates uploaded files, specifically PDFs stored as data URLs
 */

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const PDF_MAGIC_BYTES = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF

export class FileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileValidationError';
  }
}

/**
 * Validates a PDF data URL
 * @param dataUrl - The data URL to validate
 * @throws FileValidationError if validation fails
 */
export function validatePdfDataUrl(dataUrl: string | null | undefined): void {
  if (!dataUrl) {
    throw new FileValidationError('Data URL is required');
  }

  // Check format
  if (!dataUrl.startsWith('data:application/pdf;base64,')) {
    throw new FileValidationError('Invalid PDF data URL format. Must be data:application/pdf;base64,...');
  }

  // Extract base64 data
  const parts = dataUrl.split(',');
  if (parts.length !== 2) {
    throw new FileValidationError('Invalid data URL structure');
  }

  const base64Data = parts[1];
  
  // Validate base64 format
  if (!/^[A-Za-z0-9+/=]+$/.test(base64Data)) {
    throw new FileValidationError('Invalid base64 encoding');
  }

  // Check size (approximate, base64 is ~33% larger than original)
  const sizeInBytes = (base64Data.length * 3) / 4;
  if (sizeInBytes > MAX_FILE_SIZE) {
    const maxMB = (MAX_FILE_SIZE / 1024 / 1024).toFixed(1);
    const actualMB = (sizeInBytes / 1024 / 1024).toFixed(1);
    throw new FileValidationError(
      `File size (${actualMB}MB) exceeds ${maxMB}MB limit`
    );
  }

  // Decode and validate magic bytes
  let decoded: Buffer;
  try {
    decoded = Buffer.from(base64Data, 'base64');
  } catch (error) {
    throw new FileValidationError('Failed to decode base64 data');
  }

  // Minimum size check (valid PDF should be at least a few bytes)
  if (decoded.length < 100) {
    throw new FileValidationError('File too small to be a valid PDF');
  }

  // Check PDF magic bytes at the start
  if (!decoded.subarray(0, 4).equals(PDF_MAGIC_BYTES)) {
    throw new FileValidationError(
      'File is not a valid PDF (invalid magic bytes). Only PDF files are allowed.'
    );
  }

  // Additional check: PDF should contain "PDF-" version signature
  const header = decoded.subarray(0, 100).toString('utf-8', 0, 100);
  if (!header.includes('%PDF-')) {
    throw new FileValidationError('Invalid PDF header signature');
  }

  // Check for PDF trailer (valid PDFs should have "%%EOF" at the end)
  const trailer = decoded.subarray(Math.max(0, decoded.length - 100)).toString('utf-8');
  if (!trailer.includes('%%EOF')) {
    throw new FileValidationError('Invalid or corrupted PDF file (missing EOF marker)');
  }
}

/**
 * Validates all attachments in a record
 * @param attachments - Record of attachment values
 * @param requiredKeys - Optional array of keys that must have valid files
 * @throws FileValidationError if validation fails
 */
export function validateAttachmentRecord(
  attachments: Record<string, any>,
  requiredKeys: string[] = []
): void {
  const errors: string[] = [];

  // Validate each attachment that has a dataUrl
  for (const [key, value] of Object.entries(attachments)) {
    if (value?.dataUrl) {
      try {
        validatePdfDataUrl(value.dataUrl);
      } catch (error) {
        if (error instanceof FileValidationError) {
          errors.push(`${key}: ${error.message}`);
        } else {
          errors.push(`${key}: Validation failed`);
        }
      }
    } else if (requiredKeys.includes(key)) {
      errors.push(`${key}: Required attachment is missing`);
    }
  }

  if (errors.length > 0) {
    throw new FileValidationError(
      `Attachment validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`
    );
  }
}

/**
 * Gets human-readable file size
 */
export function getMaxFileSizeMB(): number {
  return MAX_FILE_SIZE / 1024 / 1024;
}

