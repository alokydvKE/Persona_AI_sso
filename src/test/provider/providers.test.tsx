import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { useSelector } from "react-redux";
import { useQueryClient } from "@tanstack/react-query";
import { ReduxProviders } from "../../provider/reduxProvider";
import { TanstackProvider } from "../../provider/tanstackProvider";
import type { RootState } from "@/redux/store";

describe("ReduxProviders", () => {
  it("provides the redux store to children", () => {
    function Probe() {
      const projects = useSelector((s: RootState) => s.Project.projects);
      return <span>projects:{projects.length}</span>;
    }
    render(
      <ReduxProviders>
        <Probe />
      </ReduxProviders>,
    );
    expect(screen.getByText("projects:0")).toBeInTheDocument();
  });
});

describe("TanstackProvider", () => {
  it("provides a query client to children", () => {
    function Probe() {
      const client = useQueryClient();
      return <span>{client ? "has-client" : "no-client"}</span>;
    }
    render(
      <TanstackProvider>
        <Probe />
      </TanstackProvider>,
    );
    expect(screen.getByText("has-client")).toBeInTheDocument();
  });
});
