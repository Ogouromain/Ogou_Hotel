/**
 * OGOU_Hôtel - File Validation Utilities
 *
 * Security: Validates uploaded files server-side using:
 * 1. Size limit enforcement (prevents DoS via oversized uploads)
 * 2. Real MIME type detection via magic numbers (file signatures)
 *    - Prevents MIME confusion attacks where a malicious file
 *      declares itself as image/jpeg but is actually an executable
 * 3. Allowed MIME type whitelist (only CNI/passport-safe formats)
 */

// ─── Configuration ──────────────────────────────────────────────────────────────

/** Maximum file size in bytes (5 MB) */
export const MAX_FILE_SIZE = 5 * 1024 * 1024

/** Allowed MIME types for identity document uploads */
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number]

/** Map allowed MIME types to file extensions */
const MIME_TO_EXTENSION: Record<AllowedMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

/**
 * Convert a MIME type to its file extension.
 * Only works for allowed MIME types; returns undefined for unknown types.
 */
export function mimeToExtension(mimeType: AllowedMimeType): string | undefined {
  return MIME_TO_EXTENSION[mimeType]
}

// ─── Magic Number Signatures ────────────────────────────────────────────────────
// Each signature is a list of byte patterns at specific offsets.
// A file matches if ALL bytes in a pattern match at the given offset.

interface FileSignature {
  mimeType: AllowedMimeType
  offset: number
  bytes: number[] // Hex byte values to match
}

const FILE_SIGNATURES: FileSignature[] = [
  // JPEG: starts with FF D8 FF
  { mimeType: 'image/jpeg', offset: 0, bytes: [0xff, 0xd8, 0xff] },

  // PNG: starts with 89 50 4E 47 0D 0A 1A 0A
  { mimeType: 'image/png', offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },

  // PDF: starts with 25 50 44 46 (%PDF)
  { mimeType: 'application/pdf', offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] },

  // WebP: RIFF....WEBP
  { mimeType: 'image/webp', offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF
  // Note: Full WebP check also requires bytes 8-11 = WEBP, but RIFF header is a strong first check
]

// ─── Validation Functions ────────────────────────────────────────────────────────

/**
 * Detects the real MIME type of a file by checking its magic number signature.
 * This prevents MIME confusion attacks where a file's declared Content-Type
 * doesn't match its actual content.
 *
 * @param buffer - The file content as a Buffer
 * @returns The detected MIME type, or null if no known signature matches
 */
export function detectRealMimeType(buffer: Buffer): AllowedMimeType | null {
  for (const sig of FILE_SIGNATURES) {
    if (buffer.length < sig.offset + sig.bytes.length) {
      continue
    }

    let matches = true
    for (let i = 0; i < sig.bytes.length; i++) {
      if (buffer[sig.offset + i] !== sig.bytes[i]) {
        matches = false
        break
      }
    }

    if (matches) {
      return sig.mimeType
    }
  }

  return null
}

/**
 * Validates that a WebP file has the complete signature (RIFF + WEBP).
 * This is a secondary check since WebP has a split signature.
 */
function isCompleteWebPSignature(buffer: Buffer): boolean {
  // WebP format: bytes 0-3 = "RIFF", bytes 8-11 = "WEBP"
  if (buffer.length < 12) return false

  const riffMatch =
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46    // F

  const webpMatch =
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50   // P

  return riffMatch && webpMatch
}

export interface FileValidationResult {
  valid: boolean
  error?: string
  detectedMimeType?: AllowedMimeType
}

/**
 * Comprehensive file validation for identity document uploads.
 *
 * Checks:
 * 1. File size is within the allowed limit
 * 2. Declared MIME type is in the allowed list
 * 3. Real MIME type (via magic number) matches the declared type
 * 4. For WebP, verifies the complete RIFF+WEBP signature
 *
 * @param fileData - Base64 encoded file data
 * @param declaredMimeType - The MIME type declared by the client
 * @returns Validation result with detected MIME type or error message
 */
export function validateIdentityDocument(
  fileData: string,
  declaredMimeType: string
): FileValidationResult {
  // 1. Validate declared MIME type is in allowed list
  if (!ALLOWED_MIME_TYPES.includes(declaredMimeType as AllowedMimeType)) {
    return {
      valid: false,
      error: `Type de fichier non autorisé. Types acceptés : ${ALLOWED_MIME_TYPES.join(', ')}. Type déclaré : ${declaredMimeType}`,
    }
  }

  // 2. Decode base64 and validate size
  let buffer: Buffer
  try {
    buffer = Buffer.from(fileData, 'base64')
  } catch {
    return {
      valid: false,
      error: 'Données de fichier invalides. Le fichier n\'est pas correctement encodé en base64.',
    }
  }

  if (buffer.length === 0) {
    return {
      valid: false,
      error: 'Le fichier est vide.',
    }
  }

  if (buffer.length > MAX_FILE_SIZE) {
    const sizeMB = (buffer.length / (1024 * 1024)).toFixed(1)
    const maxMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0)
    return {
      valid: false,
      error: `Fichier trop volumineux (${sizeMB} Mo). Taille maximale autorisée : ${maxMB} Mo.`,
    }
  }

  // 3. Detect real MIME type via magic number
  const detectedMimeType = detectRealMimeType(buffer)

  if (!detectedMimeType) {
    return {
      valid: false,
      error: 'Impossible de déterminer le type réel du fichier. Le fichier semble corrompu ou n\'est pas dans un format autorisé (JPEG, PNG, WebP, PDF).',
    }
  }

  // 4. Verify that the detected type matches the declared type
  if (detectedMimeType !== declaredMimeType) {
    return {
      valid: false,
      error: `Incohérence de type de fichier. Le fichier est réellement de type "${detectedMimeType}" mais déclare être "${declaredMimeType}". Veuillez utiliser un fichier authentique.`,
    }
  }

  // 5. Extra validation for WebP: verify complete signature
  if (detectedMimeType === 'image/webp' && !isCompleteWebPSignature(buffer)) {
    return {
      valid: false,
      error: 'Le fichier WebP est corrompu ou invalide. La signature RIFF+WEBP est incomplète.',
    }
  }

  return {
    valid: true,
    detectedMimeType,
  }
}
