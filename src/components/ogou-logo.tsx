import Image from 'next/image'

interface OgouLogoProps {
  /** Height of the logo. Width auto-calculated to maintain aspect ratio. */
  height?: number
  /** Additional CSS classes for the wrapper */
  className?: string
  /** Whether to show the brand text next to the logo */
  showText?: boolean
  /** Size variant for the text */
  textVariant?: 'default' | 'large' | 'small'
  /** Priority loading for above-the-fold logos */
  priority?: boolean
}

export function OgouLogo({
  height = 40,
  className = '',
  showText = true,
  textVariant = 'default',
  priority = false,
}: OgouLogoProps) {
  const textSizes = {
    small: 'text-sm',
    default: 'text-lg',
    large: 'text-2xl',
  }

  const textClass = textSizes[textVariant]

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Image
        src="/logo.png"
        alt="OGOU_Hôtel - Logo ROMAIN OGOU"
        height={height}
        width={height * 1.2}
        priority={priority}
        className="object-contain"
      />
      {showText && (
        <span className={`font-bold tracking-tight ${textClass}`}>
          <span className="bg-gradient-to-r from-emerald-600 to-green-500 bg-clip-text text-transparent">
            OGOU
          </span>
          <span className="text-gray-700 dark:text-gray-200">_Hôtel</span>
        </span>
      )}
    </div>
  )
}

/**
 * Compact logo variant for sidebar headers and small spaces.
 * Shows only the "RO" monogram icon without the full logo image.
 */
export function OgouLogoCompact({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Image
        src="/logo.png"
        alt="OGOU_Hôtel"
        height={36}
        width={36}
        className="object-contain rounded-lg"
      />
      <div className="flex-1 min-w-0">
        <h1 className="text-base font-bold bg-gradient-to-r from-emerald-600 to-green-500 bg-clip-text text-transparent">
          OGOU_Hôtel
        </h1>
      </div>
    </div>
  )
}
