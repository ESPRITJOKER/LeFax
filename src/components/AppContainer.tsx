import type { ReactNode } from "react";

/**
 * Centers a screen's content in a comfortable max-width column on desktop while
 * staying edge-to-edge on phones. Drop it directly inside a screen's scroll
 * region so single-column lists and forms don't stretch across a wide monitor,
 * while multi-column grids inside can still expand. `wide` bumps the cap for
 * grid-heavy dashboards.
 */
export function AppContainer({
  children,
  wide = false,
  className = "",
}: {
  children: ReactNode;
  wide?: boolean;
  className?: string;
}) {
  return (
    <div className={`w-full mx-auto ${wide ? "lg:max-w-[1180px]" : "lg:max-w-[860px]"} ${className}`}>
      {children}
    </div>
  );
}
