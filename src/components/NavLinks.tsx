"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <>
      {links.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}
            className={`shrink-0 border-b-[3px] px-3 py-3 font-medium transition-colors ${
              active ? "border-gold-500 text-brand-700" : "border-transparent text-stone-600 hover:border-gold-300 hover:text-brand-700"}`}>
            {l.label}
          </Link>
        );
      })}
    </>
  );
}
