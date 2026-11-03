import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PersonaEvidence from "../../../../components/common/Chat/PersonaEvidence";

type Category = {
  theme_id: string;
  theme_name: string;
  items: { label: string | null; support_pct: number | null; n: number | null }[];
};

const makeData = (over: Partial<Record<string, unknown>> = {}) =>
  ({
    persona_id: "x1",
    persona_name: "Ann",
    status: "ready",
    matched_respondents: 10,
    unique_studies: 1,
    unique_respondents: 10,
    study_summary: [
      { study_type_id: "ua", total_rows: 20, unique_respondent_count: 10 },
    ],
    evidence_by_category: [
      {
        theme_id: "t1",
        theme_name: "Pricing",
        items: [{ label: "Price sensitive", support_pct: 72.4, n: 10 }],
      },
    ] as Category[],
    ...over,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

describe("PersonaEvidence", () => {
  it("renders nothing without data", () => {
    const { container } = render(<PersonaEvidence />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when there are no studies and no evidence", () => {
    const { container } = render(
      <PersonaEvidence data={makeData({ study_summary: [], evidence_by_category: [] })} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("formats study types and shows the matched N", () => {
    render(<PersonaEvidence data={makeData()} />);
    expect(screen.getByText(/U&A n=10/)).toBeInTheDocument();
  });

  it("renders evidence categories with rounded support percentages", () => {
    render(<PersonaEvidence data={makeData()} />);
    expect(screen.getByText("Pricing")).toBeInTheDocument();
    expect(screen.getByText("Price sensitive")).toBeInTheDocument();
    expect(screen.getByText("72%")).toBeInTheDocument();
  });

  it("renders all evidence categories (scrollable, not sliced)", () => {
    const categories: Category[] = [1, 2, 3].map((i) => ({
      theme_id: `t${i}`,
      theme_name: `Theme ${i}`,
      items: [{ label: `Item ${i}`, support_pct: 50, n: 5 }],
    }));
    render(<PersonaEvidence data={makeData({ evidence_by_category: categories })} />);

    // No slicing: every category is mounted; overflow is scrolled, not hidden.
    expect(screen.getByText("Theme 1")).toBeInTheDocument();
    expect(screen.getByText("Theme 2")).toBeInTheDocument();
    expect(screen.getByText("Theme 3")).toBeInTheDocument();
  });

  it("expanded by default exposes a Collapse toggle without dropping content", async () => {
    const categories: Category[] = [1, 2, 3].map((i) => ({
      theme_id: `t${i}`,
      theme_name: `Theme ${i}`,
      items: [{ label: `Item ${i}`, support_pct: 50, n: 5 }],
    }));
    const user = userEvent.setup();
    render(
      <PersonaEvidence
        data={makeData({ evidence_by_category: categories })}
        defaultExpanded
      />,
    );

    const collapse = screen.getByRole("button", { name: /collapse/i });
    expect(collapse).toBeInTheDocument();

    // Collapsing keeps every category mounted (they're scrolled, not removed).
    await user.click(collapse);
    expect(screen.getByText("Theme 3")).toBeInTheDocument();
  });
});
