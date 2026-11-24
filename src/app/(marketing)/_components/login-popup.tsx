"use client";

import { useEffect, useRef } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";

export function LoginPopup() {
  const { openSignIn } = useClerk();
  const { isLoaded, isSignedIn } = useUser();
  const searchParams = useSearchParams();
  const router = useRouter();
  const opened = useRef(false);

  useEffect(() => {
    if (!isLoaded || searchParams.get("sign-in") !== "true" || opened.current) return;
    opened.current = true;
    // Accept only same-origin paths, even if someone edits the query string.
    const requested = searchParams.get("returnTo") || "/learn";
    let returnTo = "/learn";
    try {
      const destination = new URL(requested, window.location.origin);
      if (requested.startsWith("/") && destination.origin === window.location.origin) {
        returnTo = destination.pathname + destination.search + destination.hash;
      }
    } catch {
      // Malformed return paths use the standard learning page.
    }
    if (isSignedIn) {
      router.replace(returnTo);
      return;
    }
    openSignIn({ forceRedirectUrl: returnTo, signUpForceRedirectUrl: returnTo });
  }, [isLoaded, isSignedIn, openSignIn, router, searchParams]);

  return null;
}
