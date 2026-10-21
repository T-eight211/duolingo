import { create } from "zustand";

type ExitModelState = {
  isOpen: boolean;
  redirectUrl?: string;
  open: (redirectUrl?: string | unknown) => void;
  close: () => void;
};

export const useExitModal = create<ExitModelState>((set) => ({
  isOpen: false,
  redirectUrl: undefined,
  open: (redirectUrl?: unknown) =>
    set({
      isOpen: true,
      redirectUrl: typeof redirectUrl === "string" ? redirectUrl : undefined,
    }),
  close: () => set({ isOpen: false, redirectUrl: undefined }),
}));
