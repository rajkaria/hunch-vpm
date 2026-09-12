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

  return (
    <header className="sticky top-0 z-40 border-b border-edge bg-raised">
      <div className="mx-auto flex w-full max-w-[1180px] items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-3 py-1" aria-label="Hunch VPM, home">
          {/*
            The staged lockup, used as it was drawn. It is never recoloured,
            never stretched — width and height move together — and never given
            a shadow or a glow. The padding around it is well over the 17-unit
            clear space the guidelines ask for.
          */}
          <img src="/brand/hunch-lockup.svg" alt="Hunch" width={113} height={24} className="h-6 w-auto" />
          <span className="num border border-edge px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
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
                className={`shrink-0 px-3 py-2 text-sm transition-colors ${
                  active ? 'bg-paper/8 font-semibold text-paper' : 'text-muted hover:text-paper'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <span
          className="num hidden shrink-0 items-center gap-2 border border-edge px-2.5 py-1.5 text-[11px] text-muted sm:flex"
          title={`Chain id ${ARC_TESTNET.id}`}
        >
          <span aria-hidden className="inline-block h-1.5 w-1.5 bg-lime" />
          {ARC_TESTNET.name}
        </span>
      </div>
    </header>
  );
}
