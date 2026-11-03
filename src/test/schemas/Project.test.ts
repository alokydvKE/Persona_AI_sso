import { describe, it, expect } from "vitest";
import { CreateProject, UpdateProject } from "../../schemas/Project";

describe("CreateProject schema", () => {
  const valid = {
    project_type: "brand_representative",
    project_name: "Acme Personas",
    description: "Consumer research project",
  };

  it("accepts a fully valid payload", () => {
    expect(CreateProject.safeParse(valid).success).toBe(true);
  });

  it("rejects an unknown project type", () => {
    const result = CreateProject.safeParse({ ...valid, project_type: "other" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/select a project type/i);
  });

  it("rejects a project name shorter than 4 characters", () => {
    const result = CreateProject.safeParse({ ...valid, project_name: "ab" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/at least 4 characters/i);
  });

  it("rejects a project name longer than 50 characters", () => {
    const result = CreateProject.safeParse({ ...valid, project_name: "x".repeat(51) });
    expect(result.success).toBe(false);
  });

  it("rejects a description shorter than 4 characters", () => {
    const result = CreateProject.safeParse({ ...valid, description: "no" });
    expect(result.success).toBe(false);
  });
});

describe("UpdateProject schema", () => {
  it("accepts a name with an optional description omitted", () => {
    expect(UpdateProject.safeParse({ project_name: "Renamed" }).success).toBe(true);
  });

  it("rejects a name shorter than 2 characters", () => {
    expect(UpdateProject.safeParse({ project_name: "a" }).success).toBe(false);
  });

  it("rejects a description longer than 150 characters", () => {
    const result = UpdateProject.safeParse({
      project_name: "Valid Name",
      description: "y".repeat(151),
    });
    expect(result.success).toBe(false);
  });
});
