"use client";

import { Menu } from "lucide-react";
import React from "react";
import { SideBar } from "@/components/sidebar";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export const MobileSideBar = () => {
  const [open, setOpen] = React.useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger aria-label="Open navigation">
        <Menu className="text-white" />
      </SheetTrigger>
      <SheetContent className="p-0 z-100" side="left" aria-describedby={undefined}>
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SideBar onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
};

