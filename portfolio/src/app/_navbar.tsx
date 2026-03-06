"use client";

import type { ReactNode } from "react";
import profile from "./_profile.jpg";
import Image from "next/image";
import Link from "next/link";
import { Fragment } from "react";
import { usePathname } from "next/navigation";

function Title(props: { isHome: boolean }) {
  return (
    <h1 className="font-bold leading-none whitespace-nowrap text-5xl">
      {props.isHome ? (
        <span className="inline-flex items-baseline">Hi! I'm Ashwin!</span>
      ) : (
        <span className="inline-flex items-baseline">Ashwin Mahadevan</span>
      )}
    </h1>
  );
}

function MenuItem(props: { href: string; children: ReactNode }) {
  return (
    <div className="relative flex flex-col leading-none group">
      <Link href={props.href} className="text-sm">
        {props.children}
      </Link>
      <div className="absolute bottom-0 left-0 w-full h-1 translate-y-1 bg-white origin-right scale-x-0 group-hover:scale-x-100 transition-transform" />
    </div>
  );
}

export function Navigation() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <Fragment>
      <div className="flex items-end justify-between sticky top-0 border-b border-mauve-ui-hover py-4 h-24">
        <div className="flex items-end gap-4">
          <Image
            src={profile}
            alt="Ashwin Mahadevan"
            className="rounded-full w-16 h-16"
          />

          <Title isHome={isHome} />
        </div>

        <div className="flex flex-col items-end gap-2 justify-around">
          <MenuItem href="/about">About</MenuItem>
          <MenuItem href="/blog">Blog</MenuItem>
          <MenuItem href="/contact">Contact</MenuItem>
        </div>
      </div>
    </Fragment>
  );
}
