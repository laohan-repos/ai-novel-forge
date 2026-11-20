import type { ReactNode } from "react";

type IconProps = {
  className?: string;
};

function StrokeIcon({
  className,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function IconBookMark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M11.15 6.15c-1.15-.72-2.55-1.2-4.15-1.2H4.6v12.3h2.4c1.45 0 2.8.38 4.15 1.15V6.15Z"
      />
      <path
        fill="currentColor"
        d="M12.85 6.15c1.15-.72 2.55-1.2 4.15-1.2h2.4v12.3h-2.4c-1.45 0-2.8.38-4.15 1.15V6.15Z"
      />
    </svg>
  );
}

export function IconSearch({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <circle cx="11" cy="11" r="6.25" />
      <path d="m16 16 3.4 3.4" />
    </StrokeIcon>
  );
}

export function IconBell({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M6.2 16.2h11.6l-1.15-1.9V10.2a4.65 4.65 0 0 0-9.3 0v4.1l-1.15 1.9Z" />
      <path d="M10 16.4a2 2 0 0 0 4 0" />
    </StrokeIcon>
  );
}

export function IconGlobe({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16" />
      <path d="M12 4c2.2 2.4 3.3 5.1 3.3 8S14.2 17.6 12 20c-2.2-2.4-3.3-5.1-3.3-8S9.8 6.4 12 4Z" />
    </StrokeIcon>
  );
}

export function IconPerson({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <circle cx="12" cy="8" r="3.1" />
      <path d="M5.8 19.2c.7-3.1 2.9-4.7 6.2-4.7s5.5 1.6 6.2 4.7" />
    </StrokeIcon>
  );
}

export function IconPlot({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <circle cx="12" cy="5.5" r="2.1" />
      <circle cx="6" cy="17.5" r="2.1" />
      <circle cx="18" cy="17.5" r="2.1" />
      <path d="M12 7.6v3.2M12 10.8 6.4 15.2M12 10.8l5.6 4.4" />
    </StrokeIcon>
  );
}

export function IconMemory({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="m5 8 7-2.6L19 8l-7 2.6L5 8Z" />
      <path d="m5 12 7 2.6L19 12" />
      <path d="m5 16 7 2.6L19 16" />
    </StrokeIcon>
  );
}

export function IconShield({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M12 3.6 19 6.4v5c0 3.9-2.7 6.6-7 8.1-4.3-1.5-7-4.2-7-8.1v-5L12 3.6Z" />
      <path d="m8.7 11.8 2.2 2.2 4.4-4.5" />
    </StrokeIcon>
  );
}

export function IconUpload({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M12 15.2V4.8" />
      <path d="m8.2 8.4 3.8-3.8 3.8 3.8" />
      <path d="M5.2 14.5v4.2h13.6v-4.2" />
    </StrokeIcon>
  );
}

export function IconPencil({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M13.6 5.2 18.8 10.4 9.2 20H4v-5.2L13.6 5.2Z" />
      <path d="m12 6.8 5.2 5.2" />
    </StrokeIcon>
  );
}

export function IconHome({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M11.15 3.7a1.25 1.25 0 0 1 1.7 0l7.4 6.85c.35.32.55.77.55 1.24V20a1.4 1.4 0 0 1-1.4 1.4h-4.55v-5.7a1.15 1.15 0 0 0-1.15-1.15h-2.4a1.15 1.15 0 0 0-1.15 1.15v5.7H4.6A1.4 1.4 0 0 1 3.2 20v-8.21c0-.47.2-.92.55-1.24l7.4-6.85Z"
      />
    </svg>
  );
}

export function IconNovel({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M6 5.2h4.4c.5.55 1.25.85 2.1.85s1.6-.3 2.1-.85H18.5V19H14.6c-.5-.55-1.25-.85-2.1-.85s-1.6.3-2.1.85H6V5.2Z" />
      <path d="M12 6.1v12" />
    </StrokeIcon>
  );
}

export function IconPen({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M14.2 4.6 19.4 9.8 8.6 20.6H3.4V15.4L14.2 4.6Z" />
      <path d="m12.4 6.4 5.2 5.2" />
    </StrokeIcon>
  );
}

export function IconUser({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <circle cx="12" cy="8.2" r="3.15" />
      <path d="M5.4 19.4c.85-3.15 3.05-4.75 6.6-4.75s5.75 1.6 6.6 4.75" />
    </StrokeIcon>
  );
}

export function IconChevron({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="m9 6 6 6-6 6" />
    </StrokeIcon>
  );
}

export function IconBack({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.15"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M15 5.2 8.2 12 15 18.8" />
    </svg>
  );
}

export function IconChevronDown({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="m6.2 9 5.8 5.8L17.8 9" />
    </svg>
  );
}

export function IconCheck({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="m5 12.4 4.4 4.4L19 7.2" />
    </svg>
  );
}

export function IconMore({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="5.2" cy="12" r="1.35" fill="currentColor" />
      <circle cx="12" cy="12" r="1.35" fill="currentColor" />
      <circle cx="18.8" cy="12" r="1.35" fill="currentColor" />
    </svg>
  );
}

export function IconPlus({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M12 5.5v13M5.5 12h13" />
    </StrokeIcon>
  );
}

export function IconDots({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="6" cy="12" r="1.35" fill="currentColor" />
      <circle cx="12" cy="12" r="1.35" fill="currentColor" />
      <circle cx="18" cy="12" r="1.35" fill="currentColor" />
    </svg>
  );
}

export function IconHomeStroke({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M4.2 11.2 12 4.4l7.8 6.8" />
      <path d="M6.4 10.2V19h4.2v-4.2h2.8V19h4.2v-8.8" />
    </StrokeIcon>
  );
}

export function IconNovelSolid({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M11.35 5.35c-1.1-.65-2.4-1.05-3.9-1.05H4.6v12.6h2.85c1.35 0 2.6.36 3.7 1.05V5.35Z"
      />
      <path
        fill="currentColor"
        d="M12.65 5.35c1.1-.65 2.4-1.05 3.9-1.05h2.85v12.6h-2.85c-1.35 0-2.6.36-3.7 1.05V5.35Z"
      />
    </svg>
  );
}

export function NovelCover({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 112 148"
      className={className}
      aria-hidden
      role="img"
    >
      <defs>
        <linearGradient id="cover-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d7e3f1" />
          <stop offset="48%" stopColor="#e7eef6" />
          <stop offset="100%" stopColor="#c9d6e6" />
        </linearGradient>
        <linearGradient id="cover-mist" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f7f4ef" stopOpacity="0" />
          <stop offset="100%" stopColor="#f3efe8" stopOpacity="0.92" />
        </linearGradient>
      </defs>
      <rect width="112" height="148" fill="url(#cover-sky)" />
      <path d="M0 58 16 36l14 16 12-20 18 22 20-28 18 24 14-12v110H0Z" fill="#b7c8da" />
      <path d="M0 78 20 48l16 20 18-26 22 30 20-16 16 14v78H0Z" fill="#8ea6bf" opacity="0.9" />
      <path d="M0 100 22 72l18 16 16-20 24 26 18-16 14 12v58H0Z" fill="#6d879f" />
      <path d="M0 122 26 100l20 14 18-18 22 16 26 8v28H0Z" fill="#3f556c" />
      <ellipse cx="36" cy="108" rx="40" ry="18" fill="#f4f1eb" opacity="0.55" />
      <ellipse cx="78" cy="118" rx="42" ry="16" fill="#f7f4ef" opacity="0.72" />
      <path d="M22 112 27 94l5 18Z" fill="#31465c" />
      <path d="M27 104 31 90l4 14Z" fill="#3d556c" />
      <path d="M74 108 80 86l6 22Z" fill="#2d4358" />
      <path d="M80 98 85 80l5 18Z" fill="#3c546b" />
      <path d="M0 124c20 8 38 6 56-4 18 12 36 12 56 0v24H0Z" fill="url(#cover-mist)" />
    </svg>
  );
}

export function StarSeaCover({ className }: IconProps) {
  return (
    <svg viewBox="0 0 112 148" className={className} aria-hidden>
      <defs>
        <linearGradient id="space-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#07111f" />
          <stop offset="55%" stopColor="#102848" />
          <stop offset="100%" stopColor="#1a3d68" />
        </linearGradient>
        <radialGradient id="space-planet" cx="38%" cy="36%" r="68%">
          <stop offset="0%" stopColor="#d7f1ff" />
          <stop offset="28%" stopColor="#6eb6f5" />
          <stop offset="62%" stopColor="#2a62c8" />
          <stop offset="100%" stopColor="#12306a" />
        </radialGradient>
      </defs>
      <rect width="112" height="148" fill="url(#space-sky)" />
      <circle cx="18" cy="22" r="1.1" fill="#fff" />
      <circle cx="34" cy="40" r="0.8" fill="#d5e7ff" />
      <circle cx="88" cy="18" r="1" fill="#fff" />
      <circle cx="96" cy="48" r="0.7" fill="#ffe1c2" />
      <circle cx="24" cy="70" r="0.7" fill="#fff" />
      <circle cx="100" cy="78" r="0.8" fill="#fff" />
      <circle cx="78" cy="30" r="0.6" fill="#fff" />
      <circle cx="62" cy="68" r="34" fill="url(#space-planet)" />
      <ellipse
        cx="62"
        cy="66"
        rx="36"
        ry="9"
        fill="none"
        stroke="#e7f6ff"
        strokeOpacity="0.55"
        transform="rotate(-18 62 66)"
      />
      <circle cx="94" cy="40" r="5.5" fill="#e15a48" />
      <circle cx="92" cy="38" r="2" fill="#ffb199" opacity="0.8" />
      <path d="M0 112 18 84l16 18 14-24 18 22 16-20 16 16 14-10v62H0Z" fill="#0c1830" />
      <path d="M0 128 24 108l18 12 16-16 22 14 32 6v24H0Z" fill="#08111f" />
    </svg>
  );
}

export function RiverCover({ className }: IconProps) {
  return (
    <svg viewBox="0 0 112 148" className={className} aria-hidden>
      <defs>
        <linearGradient id="river-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f8e7b0" />
          <stop offset="42%" stopColor="#f3d48a" />
          <stop offset="100%" stopColor="#d7e7c4" />
        </linearGradient>
      </defs>
      <rect width="112" height="148" fill="url(#river-sky)" />
      <circle cx="30" cy="36" r="16" fill="#fff6d2" />
      <circle cx="30" cy="36" r="11" fill="#ffe08a" />
      <path d="M0 96c16-10 24-28 28-40 6 16 16 28 28 34-8 8-14 20-16 36H0Z" fill="#2f6a42" />
      <path d="M8 108c10-18 16-34 14-48 8 14 16 24 26 28-6 10-10 22-8 40H0c2-8 4-14 8-20Z" fill="#1f5534" />
      <path d="M78 70h28l-4 8H82Z" fill="#8d342c" />
      <path d="M84 62h16l-2 8H86Z" fill="#a84438" />
      <rect x="86" y="78" width="12" height="20" rx="1" fill="#c56a45" />
      <path d="M90 86h4M90 92h4" stroke="#f3d7b0" strokeWidth="1.2" />
      <path d="M70 148c8-22 16-36 28-52 6 10 14 16 22 16v36H70Z" fill="#3e7d52" />
      <path d="M46 148c6-16 14-28 22-46 4 8 10 16 18 22 2 10 2 18 0 24H46Z" fill="#d8efe6" />
      <path d="M52 148c4-12 10-22 16-34" fill="none" stroke="#f7fffb" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="96" cy="118" rx="14" ry="18" fill="#2a6840" />
      <ellipse cx="104" cy="108" rx="10" ry="14" fill="#3d8154" />
    </svg>
  );
}
