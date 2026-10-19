import type { CSSProperties } from 'react'

export type IconName =
  | 'command'
  | 'globe-3d'
  | 'satellite'
  | 'compass'
  | 'sparkles'
  | 'sprout'
  | 'leaf'
  | 'sun'
  | 'moon'
  | 'help'
  | 'map-pin'
  | 'navigation'
  | 'crosshair'
  | 'plus'
  | 'trash'
  | 'close'
  | 'check'
  | 'arrow-right'
  | 'arrow-down-right'
  | 'chevron-right'
  | 'chevron-down'
  | 'thermometer-sun'
  | 'cloud-rain'
  | 'gauge'
  | 'flask'
  | 'droplets'
  | 'waves'
  | 'trending-up'
  | 'shield-check'
  | 'external-link'
  | 'refresh'
  | 'download'
  | 'settings'
  | 'loader'
  | 'maximize'
  | 'minimize'
  | 'zoom-in'
  | 'zoom-out'
  | 'layers'

export type IconTone = 'inactive' | 'lime' | 'cyan' | 'inherit'

interface SvgIconProps {
  name: IconName
  size?: number
  tone?: IconTone
  className?: string
}

/**
 * Borderless SVG icon component referencing `/icons/${name}.svg` from Vite public folder.
 * Uses CSS mask-image paired with an eager `<img>` asset probe so icons dynamically
 * transition between muted slate-gray (inactive), lime green (active), and cyan (map actions)
 * with smooth mouse-hover reactions.
 */
export function SvgIcon({
  name,
  size = 20,
  tone = 'inherit',
  className = '',
}: SvgIconProps) {
  const src = `/icons/${name}.svg`
  const clampedSize = Math.max(18, Math.min(24, size))

  const style: CSSProperties = {
    width: `${clampedSize}px`,
    height: `${clampedSize}px`,
    WebkitMaskImage: `url('${src}')`,
    maskImage: `url('${src}')`,
  }

  return (
    <span
      className={`fs-svg-icon tone-${tone} icon-${name} ${className}`.trim()}
      style={style}
      data-icon={name}
      aria-hidden="true"
    >
      <img
        src={src}
        alt=""
        width={clampedSize}
        height={clampedSize}
        className="fs-svg-img-ref"
        loading="eager"
        decoding="async"
      />
    </span>
  )
}
