import Link from "next/link";

export function BrandMark({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect width="24" height="24" rx="5" fill="var(--gold)" />
      <path d="M5.5 16.5 L9.5 11 L12.5 13.5 L18.5 7" fill="none" stroke="#0a0b0d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BrandLink() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="TradeHax Intel home">
      <BrandMark />
      <span className="text-[13px] font-semibold tracking-tight">
        TradeHax <span className="font-normal text-muted-foreground">Intel</span>
      </span>
    </Link>
  );
}
