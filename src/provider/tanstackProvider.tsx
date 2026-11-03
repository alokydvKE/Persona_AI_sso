import { QueryClientProvider } from "@tanstack/react-query";
import { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

type TanstackProviderProps = {
  children: ReactNode;
};

export const queryClient = new QueryClient();

export const TanstackProvider = ({ children }: TanstackProviderProps) => {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};
