"use client";

import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  label: string;
  iconSrc: string;
  href: string;
  onNavigate?: () => void;
};

export const SideBarItem = ({ href, iconSrc, label, onNavigate }: Props) => {
  const path = usePathname();
  const active = path === href || path.startsWith(`${href}/`);
  return (
    <Button
      variant={active ? "sidebarOutline" : "sidebar"}
      className="h-[52px] justify-start"
      asChild
    >
      <Link href={href} onNavigate={onNavigate}>
        <Image
          src={iconSrc}
          alt={label}
          className="mr-5"
          height={32}
          width={32}
        />
        {label}
      </Link>
    </Button>
  );
};
