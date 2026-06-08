import { NextRequest, NextResponse } from 'next/server'

/**
 * OGOU_Hôtel Setup Route Security
 *
 * All /api/setup/* routes must be protected by a setup key to prevent
 * unauthorized access in production. The key is verified via the
 * x-setup-key header and must match the SETUP_SECRET_KEY env variable.
 *
 * In development, a fallback key is available but should NEVER be used
 * in production.
 */

const SETUP_SECRET_KEY = process.env.SETUP_SECRET_KEY || ''

/**
 * Validates the x-setup-key header against the configured secret.
 * Returns a NextResponse error if validation fails, or null if it passes.
 *
 * Usage in setup routes:
 * ```
 * export async function GET(request: NextRequest) {
 *   const authError = validateSetupKey(request)
 *   if (authError) return authError
 *   // ... rest of handler
 * }
 * ```
 */
export function validateSetupKey(request: NextRequest): NextResponse | null {
  const providedKey = request.headers.get('x-setup-key')

  if (!SETUP_SECRET_KEY) {
    console.error('[SECURITY] SETUP_SECRET_KEY environment variable is not set. Setup routes are BLOCKED.')
    return NextResponse.json(
      {
        error: 'Configuration de sécurité manquante. La variable SETUP_SECRET_KEY n\'est pas configurée.',
        hint: 'Ajoutez SETUP_SECRET_KEY à vos variables d\'environnement pour activer les routes d\'installation.',
      },
      { status: 503 }
    )
  }

  if (!providedKey || providedKey !== SETUP_SECRET_KEY) {
    return NextResponse.json(
      { error: 'Accès non autorisé. Clé d\'installation invalide.' },
      { status: 401 }
    )
  }

  return null // Validation passed
}
