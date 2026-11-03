import { Provider } from "react-redux";
// import { store } from "@/redux/store";
import type { ReactNode } from "react";
import { store } from "@/redux/store";

interface ProvidersProps {
  children: ReactNode;
}

export function ReduxProviders({ children }: ProvidersProps) {
  return <Provider store={store}>{children}</Provider>;
}
