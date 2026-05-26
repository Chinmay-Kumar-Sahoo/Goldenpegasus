import Link from 'next/link'

type BrandLogoProps = {
  href?: string
  variant?: 'lockup' | 'mark'
  size?: 'sm' | 'md' | 'lg'
  subtitle?: string
  className?: string
}

const lockupSizes = {
  sm: 'h-8 w-[120px]',
  md: 'h-10 w-[150px]',
  lg: 'h-12 w-[180px]',
}

const markSizes = {
  sm: 'h-7 w-10',
  md: 'h-9 w-14',
  lg: 'h-12 w-16',
}

export default function BrandLogo({
  href,
  variant = 'lockup',
  size = 'md',
  subtitle,
  className = '',
}: BrandLogoProps) {
  const image = (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <img
        src={variant === 'mark' ? '/golden-pegasus-mark.svg' : '/golden-pegasus-logo.svg'}
        alt="Golden Pegasus"
        className={`${variant === 'mark' ? markSizes[size] : lockupSizes[size]} object-contain`}
      />
      {subtitle && variant === 'lockup' && (
        <span className="hidden sm:block text-[10px] font-medium leading-tight text-[#a1a1aa]">
          {subtitle}
        </span>
      )}
    </span>
  )

  if (!href) return image

  return (
    <Link href={href} aria-label="Golden Pegasus home" className="inline-flex items-center">
      {image}
    </Link>
  )
}
