'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ARC_TESTNET } from '@/lib/chain';

const LINKS = [
  { href: '/', label: 'Markets' },
  { href: '/agents', label: 'Agents' },
  { href: '/claim', label: 'Claim' },
  { href: '/docs', label: 'How it works' },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/' || pathname.startsWith('/m/');
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();

  /*
   * Translucent over the ground with a blur behind it, which is how the
   * product's own header behaves. The fallback matters: `supports-` keeps a
   * browser without backdrop-filter on an opaque bar rather than letting the
   * board scroll through the navigation.
   */
  return (
    <header className="sticky top-0 z-40 border-b border-edge bg-ink/85 supports-[backdrop-filter]:bg-ink/70 supports-[backdrop-filter]:backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1180px] items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-3 py-1" aria-label="Hunch VPM, home">
          {/*
            The staged lockup, used as it was drawn. It is never recoloured,
            never stretched — width and height move together — and never given
            a shadow or a glow. The padding around it is well over the 17-unit
            clear space the guidelines ask for.
          */}
          <img src="/brand/hunch-lockup.svg" alt="Hunch" width={113} height={24} className="h-6 w-auto" />
          <span className="rounded-tag border border-lime/30 bg-lime/10 px-2 py-1 text-[10px] leading-none font-semibold tracking-[0.12em] text-lime uppercase">
            VPM
          </span>
        </Link>

        <nav className="scroll-x -mx-1 flex min-w-0 flex-1 items-center gap-1" aria-label="Primary">
          {LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`shrink-0 rounded-pill px-3.5 py-2 text-sm transition-colors ${
                  active
                    ? 'bg-paper/10 font-semibold text-paper'
                    : 'text-muted hover:bg-paper/5 hover:text-paper'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <span
          className="num hidden shrink-0 items-center gap-2 rounded-pill border border-edge bg-ghost px-3 py-1.5 text-[11px] text-muted sm:flex"
          title={`Chain id ${ARC_TESTNET.id}`}
        >
          <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-lime shadow-[0_0_0_3px_rgba(200,240,79,0.15)]" />
          {ARC_TESTNET.name}
        </span>
      </div>
    </header>
  );
}
