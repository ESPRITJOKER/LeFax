/**
 * Vector icon set ported from the Lefax Course design reference
 * (Lefax Course.dc.html / Lefax Course Admin.dc.html — `icon()` helper).
 *
 * Per CDC section 11: SVG vector iconography exclusively, no emoji.
 */
import type { SVGProps } from "react";

export type IconName =
  | "home"
  | "book"
  | "flame"
  | "coin"
  | "trophy"
  | "chart"
  | "lock"
  | "unlock"
  | "check"
  | "chevleft"
  | "chevright"
  | "arrowright"
  | "target"
  | "calendar"
  | "users"
  | "mappin"
  | "flask"
  | "gear"
  | "scale"
  | "medcross"
  | "cap"
  | "medal"
  | "clipboard"
  | "thumbsup"
  | "message"
  | "share"
  | "wand"
  | "collapse"
  | "plus"
  | "bell"
  | "search"
  | "user"
  | "moon"
  | "sun"
  | "globe"
  | "logout"
  | "close"
  | "menu"
  | "edit"
  | "upload"
  | "shield";

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

function paths(name: IconName): string[] {
  switch (name) {
    case "home":
      return ["M4 11L12 4L20 11", "M6 10V20H10V14H14V20H18V10"];
    case "book":
      return ["M4 5C4 5 8 3 12 5C16 3 20 5 20 5V19C20 19 16 17 12 19C8 17 4 19 4 19Z", "M12 5V19"];
    case "flame":
      return [
        "M12 3C12 3 7 8 7 13C7 17 9.3 20 12 20C14.7 20 17 17 17 13C17 10.7 15.3 9.2 14.8 11C14.5 12 13.6 12.4 13.2 11.8C13.6 9 12 6 12 3Z",
      ];
    case "coin":
      return ["M12 9V15", "M9.5 12H14.5"];
    case "trophy":
      return [
        "M8 4H16V9C16 12 14.2 14 12 14C9.8 14 8 12 8 9Z",
        "M12 14V18",
        "M9 21H15",
        "M8 5H5V7C5 9.5 6.8 10.5 8.5 10.2",
        "M16 5H19V7C19 9.5 17.2 10.5 15.5 10.2",
      ];
    case "chart":
      return ["M6 20V13", "M12 20V7", "M18 20V11"];
    case "lock":
      return ["M8 11V7.5C8 5 9.8 3 12 3C14.2 3 16 5 16 7.5V11"];
    case "unlock":
      return ["M8 11V7.5C8 5.3 9.6 3.5 11.6 3.1"];
    case "check":
      return ["M5 13L9.5 18L19 6"];
    case "chevleft":
      return ["M15 5L8 12L15 19"];
    case "chevright":
      return ["M9 5L16 12L9 19"];
    case "arrowright":
      return ["M4 12H20", "M14 6L20 12L14 18"];
    case "target":
      return [];
    case "calendar":
      return ["M3 10H21", "M8 3V7", "M16 3V7"];
    case "users":
      return ["M4 20C4 16 6.3 14 9 14C11.7 14 14 16 14 20", "M14.5 15C16.8 15 19 17 19 20"];
    case "mappin":
      return ["M12 21C12 21 5 14.2 5 9A7 7 0 0 1 19 9C19 14.2 12 21 12 21Z"];
    case "flask":
      return ["M9 3H15", "M10 3V8L4.7 18.5C4.2 19.6 5 21 6.2 21H17.8C19 21 19.8 19.6 19.3 18.5L14 8V3"];
    case "gear":
      return [];
    case "scale":
      return ["M12 3V21", "M5 7H19", "M5 7L3 13H8Z", "M19 7L17 13H22Z", "M8 21H16"];
    case "medcross":
      return ["M12 4V20", "M4 12H20"];
    case "cap":
      return ["M12 4L22 9L12 14L2 9L12 4Z", "M6 11V16C6 18.2 8.7 19.5 12 19.5C15.3 19.5 18 18.2 18 16V11"];
    case "medal":
      return ["M8 14.5L6 21L12 18L18 21L16 14.5"];
    case "clipboard":
      return ["M8 10.5H16", "M8 14.5H16", "M8 18.5H13"];
    case "thumbsup":
      return [
        "M7 11V21H4V11Z",
        "M7 11L9.5 3.5C10.6 3.5 11.5 4.4 11.5 5.5V9H17.5C18.7 9 19.5 10.2 19 11.3L16.7 19.3C16.4 20.3 15.5 21 14.4 21H7",
      ];
    case "message":
      return [
        "M4 12C4 7.6 7.6 4 12 4C16.4 4 20 7.6 20 12C20 15.7 16.4 18.6 12 18.6C10.6 18.6 9.3 18.3 8.2 17.7L4 18.6L5.1 15.2C4.4 14.3 4 13.2 4 12Z",
      ];
    case "share":
      return ["M8.1 10.8L15.9 7.2", "M8.1 13.2L15.9 16.8"];
    case "wand":
      return ["M4 20L15 9", "M14 4L15 6L17 7L15 8L14 10L13 8L11 7L13 6Z"];
    case "collapse":
      return ["M4 12H20", "M4 6H20", "M4 18H20"];
    case "plus":
      return ["M12 5V19", "M5 12H19"];
    case "bell":
      return ["M6 10C6 6.7 8.7 4 12 4C15.3 4 18 6.7 18 10V15L20 18H4L6 15Z", "M10 20C10 21.1 10.9 22 12 22C13.1 22 14 21.1 14 20"];
    case "search":
      return ["M20 20L16.5 16.5"];
    case "user":
      return ["M5 20C5 16 8 14 12 14C16 14 19 16 19 20"];
    case "moon":
      return ["M20 14.5C18.9 15.4 17.5 16 16 16C12.1 16 9 12.9 9 9C9 7.5 9.6 6.1 10.5 5C6.8 5.6 4 8.9 4 12.7C4 17 7.5 20.5 11.8 20.5C15.6 20.5 18.8 17.8 19.5 14.1C19.7 14.2 19.8 14.4 20 14.5Z"];
    case "sun":
      return ["M12 4V6", "M12 18V20", "M4 12H6", "M18 12H20", "M6.3 6.3L7.8 7.8", "M16.2 16.2L17.7 17.7", "M6.3 17.7L7.8 16.2", "M16.2 7.8L17.7 6.3"];
    case "globe":
      return ["M3 12H21", "M12 3C14.5 5.7 15.8 8.8 15.8 12C15.8 15.2 14.5 18.3 12 21C9.5 18.3 8.2 15.2 8.2 12C8.2 8.8 9.5 5.7 12 3Z"];
    case "logout":
      return ["M15 17L20 12L15 7", "M20 12H9", "M9 20H5C4.4 20 4 19.6 4 19V5C4 4.4 4.4 4 5 4H9"];
    case "close":
      return ["M6 6L18 18", "M18 6L6 18"];
    case "menu":
      return ["M4 7H20", "M4 12H20", "M4 17H20"];
    case "edit":
      return ["M15 4L20 9L9 20H4V15Z"];
    case "upload":
      return ["M12 16V4", "M7 9L12 4L17 9", "M5 16V19C5 19.6 5.4 20 6 20H18C18.6 20 19 19.6 19 19V16"];
    case "shield":
      return ["M12 3L20 6.5V11.5C20 16.2 16.9 19.9 12 21C7.1 19.9 4 16.2 4 11.5V6.5Z"];
    default:
      return [];
  }
}

function circles(name: IconName): { cx: number; cy: number; r: number; fill?: boolean }[] {
  switch (name) {
    case "coin":
      return [
        { cx: 12, cy: 12, r: 8 },
        { cx: 12, cy: 12, r: 4.5 },
      ];
    case "target":
      return [
        { cx: 12, cy: 12, r: 9 },
        { cx: 12, cy: 12, r: 5 },
        { cx: 12, cy: 12, r: 1.4, fill: true },
      ];
    case "gear":
      return [
        { cx: 12, cy: 12, r: 4.2 },
        { cx: 12, cy: 12, r: 7.4 },
      ];
    case "users":
      return [
        { cx: 9, cy: 8, r: 3 },
        { cx: 17, cy: 9, r: 2.3 },
      ];
    case "mappin":
      return [{ cx: 12, cy: 9, r: 2.4 }];
    case "medal":
      return [{ cx: 12, cy: 9, r: 6 }];
    case "share":
      return [
        { cx: 6, cy: 12, r: 2.3 },
        { cx: 18, cy: 6, r: 2.3 },
        { cx: 18, cy: 18, r: 2.3 },
      ];
    case "wand":
      return [
        { cx: 18, cy: 15, r: 1.2, fill: true },
        { cx: 6, cy: 7, r: 1, fill: true },
      ];
    case "bell":
      return [];
    default:
      return [];
  }
}

/** SVG icon component. Vector-only per CDC design system — no emoji. */
export function Icon({ name, size = 20, className, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {paths(name).map((d, i) => (
        <path key={i} d={d} fill="none" />
      ))}
      {circles(name).map((c, i) => (
        <circle key={i} cx={c.cx} cy={c.cy} r={c.r} fill={c.fill ? "currentColor" : "none"} stroke={c.fill ? "none" : "currentColor"} />
      ))}
    </svg>
  );
}
