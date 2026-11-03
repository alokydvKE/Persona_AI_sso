import { describe, it, expect } from "vitest";
import GlobalModalReducer, {
  setProjectDelete,
  setProjectEdit,
} from "../../redux/GlobalModalSlice";
import { makeProject } from "@/test/factories";

const initial = { ProjectDelete: null, ProjectEdit: null };

describe("GlobalModalSlice", () => {
  it("returns the initial state", () => {
    expect(GlobalModalReducer(undefined, { type: "@@INIT" })).toEqual(initial);
  });

  it("setProjectDelete stores then clears the target id", () => {
    const opened = GlobalModalReducer(undefined, setProjectDelete("p1"));
    expect(opened.ProjectDelete).toBe("p1");
    expect(GlobalModalReducer(opened, setProjectDelete(null)).ProjectDelete).toBeNull();
  });

  it("setProjectEdit stores then clears the project being edited", () => {
    const project = makeProject();
    const opened = GlobalModalReducer(undefined, setProjectEdit(project));
    expect(opened.ProjectEdit).toEqual(project);
    expect(GlobalModalReducer(opened, setProjectEdit(null)).ProjectEdit).toBeNull();
  });

  it("keeps the delete and edit targets independent", () => {
    let state = GlobalModalReducer(undefined, setProjectDelete("p1"));
    state = GlobalModalReducer(state, setProjectEdit(makeProject({ project_id: "p2" })));
    expect(state.ProjectDelete).toBe("p1");
    expect(state.ProjectEdit?.project_id).toBe("p2");
  });
});
