/**
 * OGDC's 2025 mark, rebuilt as vector geometry.
 *
 * The whole wordmark is one primitive -- a ring of radius 56 with a 33-unit
 * stroke -- used four ways:
 *
 *   o : the full ring
 *   g : the full ring, plus a bottom half-ring hung off its lower edge
 *   d : the right half of the ring, flat edge left
 *   c : the left half of the ring, flat edge right
 *
 * Measured off the official artwork, so the proportions are the real ones
 * rather than an approximation. Drawn as strokes (not filled paths) so it stays
 * crisp at 20px in the sidebar and at 200px on the sign-in screen, and so the
 * colour can follow the theme instead of being baked into a bitmap.
 */

const R = 56; // midline radius: outer 72.5, inner 39.5
const SW = 33; // stroke width

export function LogoMark({ size = 32, color = 'currentColor', className = '', title }) {
  // Geometry normalised from the official artwork's 475 x 217 bounding box.
  const height = (size * 217) / 475;

  return (
    <svg
      width={size}
      height={height}
      viewBox="0 0 475 217"
      fill="none"
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <g stroke={color} strokeWidth={SW} fill="none">
        {/* o */}
        <circle cx="72.5" cy="72" r={R} />

        {/* g -- ring plus the bowl that hangs from its lower edge */}
        <circle cx="231.5" cy="72" r={R} />
        <path d={`M ${231.5 - R} 144.5 A ${R} ${R} 0 0 0 ${231.5 + R} 144.5`} />

        {/* d -- right half, flat edge on the left */}
        <path d={`M 317 ${72 - R} A ${R} ${R} 0 0 1 317 ${72 + R}`} />

        {/* c -- left half, flat edge on the right */}
        <path d={`M 476 ${72 - R} A ${R} ${R} 0 0 0 476 ${72 + R}`} />
      </g>
    </svg>
  );
}

/**
 * Mark plus the "the energy" tagline.
 *
 * The official tagline is set in a bespoke geometric sans; Inter at medium
 * weight is the closest thing already loaded, and rendering it as real text
 * keeps it selectable and legible at small sizes.
 */
export function Logo({ size = 30, tagline = true, markColor, taglineColor, className = '' }) {
  return (
    <span className={`inline-flex items-baseline gap-2 ${className}`} style={{ lineHeight: 1 }}>
      <LogoMark size={size * 2.2} color={markColor || 'var(--brand-teal)'} title="OGDC" />
      {tagline && (
        <span
          style={{
            fontSize: size * 0.56,
            fontWeight: 500,
            letterSpacing: '-0.01em',
            color: taglineColor || 'var(--brand-blue)',
            whiteSpace: 'nowrap',
          }}
        >
          the energy
        </span>
      )}
    </span>
  );
}

export default Logo;
