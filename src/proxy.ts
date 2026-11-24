import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher(["/", "/api/webhooks/stripe"]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    if (/^\/(api|trpc)(\/|$)/.test(request.nextUrl.pathname)) {
      await auth.protect();
      return;
    }
    const loginUrl = new URL("/", request.url);
    loginUrl.searchParams.set("sign-in", "true");
    loginUrl.searchParams.set("returnTo", request.nextUrl.pathname + request.nextUrl.search);
    await auth.protect({ unauthenticatedUrl: loginUrl.toString() });
  }
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/(api|trpc)(.*)"],
};
