import markUrl from "../assets/lefax-mark.png";
import logoUrl from "../assets/lefax-logo.png";

/**
 * LeFax brand assets. `lefax-mark.png` is the square icon (graduation cap +
 * globe + click cursor); `lefax-logo.png` is the full vertical lockup with the
 * "LeFax" wordmark. Both are trimmed crops of the source artwork, kept as PNG
 * because the 3D shading does not survive a flat SVG trace.
 */

export function LogoMark({
  size = 26,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <img
      src={markUrl}
      alt="LeFax"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: "contain", display: "block" }}
    />
  );
}

export function LogoLockup({
  height = 120,
  className = "",
}: {
  height?: number;
  className?: string;
}) {
  return (
    <img
      src={logoUrl}
      alt="LeFax"
      height={height}
      className={className}
      style={{ height, width: "auto", objectFit: "contain", display: "block" }}
    />
  );
}

export { markUrl, logoUrl };
