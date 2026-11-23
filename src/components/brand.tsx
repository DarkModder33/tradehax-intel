import Link from "next/link";

export function BrandMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="thx-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f3d27a" />
          <stop offset="1" stopColor="#c99a2e" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="rgba(243, 210, 122, 0.12)" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" fill="none" stroke="rgba(243, 210, 122, 0.35)" />
      <path d="M8 22 L13 15 L17 18.5 L24 9.5" fill="none" stroke="url(#thx-mark)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24" cy="9.5" r="1.8" fill="#f3d27a" />
    </svg>
  );
}

export function BrandLink() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="TradeHax Intel home">
      <BrandMark />
      <span className="leading-none">
        <span className="block text-[13px] font-semibold tracking-[0.16em]">TRADEHAX</span>
        <span className="block text-[10px] tracking-[0.22em] text-gold">INTEL</span>
      </span>
    </Link>
  );
}
