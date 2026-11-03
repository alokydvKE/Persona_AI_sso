import { describe, it, expect } from "vitest";
import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import { PageHeaderActions, PageHeaderTitle } from "@/components/global/PageHeader";
import { PageHeaderSlotsContext } from "@/components/global/pageHeaderSlots";

/** A minimal stand-in for the root layout: a header with the two slots. */
function Layout({ children }: { children: React.ReactNode }) {
  const [title, setTitle] = useState<HTMLElement | null>(null);
  const [actions, setActions] = useState<HTMLElement | null>(null);
  return (
    <>
      <header>
        <div data-testid="title-slot" ref={setTitle} />
        <div data-testid="actions-slot" ref={setActions} />
      </header>
      <main data-testid="page">
        <PageHeaderSlotsContext.Provider value={{ title, actions }}>
          {children}
        </PageHeaderSlotsContext.Provider>
      </main>
    </>
  );
}

describe("PageHeader", () => {
  it("renders the title, status and actions into the layout's top bar", async () => {
    render(
      <Layout>
        <PageHeaderTitle title="Product Rating Feedback" status={{ label: "Personas ready", tone: "success" }} />
        <PageHeaderActions>
          <button type="button">View personas</button>
        </PageHeaderActions>
        <p>page body</p>
      </Layout>,
    );

    const titleSlot = await screen.findByTestId("title-slot");
    expect(await within(titleSlot).findByText("Product Rating Feedback")).toBeInTheDocument();
    expect(within(titleSlot).getByRole("status")).toHaveTextContent("Personas ready");
    expect(
      within(screen.getByTestId("actions-slot")).getByRole("button", { name: "View personas" }),
    ).toBeInTheDocument();
    // Nothing is left behind in the page itself.
    expect(within(screen.getByTestId("page")).queryByText("Product Rating Feedback")).toBeNull();
  });

  it("renders in place when there is no layout", () => {
    render(
      <>
        <PageHeaderTitle title="Standalone" />
        <PageHeaderActions>
          <button type="button">Act</button>
        </PageHeaderActions>
      </>,
    );
    expect(screen.getByText("Standalone")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Act" })).toBeInTheDocument();
  });

  it("renders nothing without a title or status", () => {
    const { container } = render(<PageHeaderTitle title={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});
