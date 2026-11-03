import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useDispatch, useSelector } from "react-redux";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  UpdateProject as UpdateProjectSchema,
  type UpdateProjectForm,
} from "@/schemas/Project";
import { UpdateProject } from "@/api/Projects/mutation";
import { setProjectEdit } from "@/redux/GlobalModalSlice";
import type { AppDispatch, RootState } from "@/redux/store";

/**
 * Edit dialog for a project's title and description, opened from the row's
 * three-dot menu (Dashboard). Driven by the GlobalModal `ProjectEdit` slice:
 * it stays mounted in the table and opens whenever a project is selected for
 * editing. `status` is not edited here — only name/description are sent.
 */
const EditProjectDialog = () => {
  const dispatch = useDispatch<AppDispatch>();
  const project = useSelector((s: RootState) => s.GlobalModal.ProjectEdit);
  const open = project !== null;

  const close = () => dispatch(setProjectEdit(null));
  const { mutate, isPending } = UpdateProject(close);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateProjectForm>({
    resolver: zodResolver(UpdateProjectSchema),
    defaultValues: { project_name: "", description: "" },
  });

  // Prefill the form whenever a different project is opened for editing.
  useEffect(() => {
    if (project) {
      reset({
        project_name: project.project_name,
        description: project.description ?? "",
      });
    }
  }, [project, reset]);

  const onSubmit = (data: UpdateProjectForm) => {
    if (!project) return;
    mutate({
      project_id: project.project_id,
      project_name: data.project_name,
      description: data.description,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent className="sm:max-w-[600px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update your project's title and description.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-project-title" required>
                Project Title
              </Label>
              <Input
                data-test-id="EDIT_PROJECT_TITLE"
                id="edit-project-title"
                placeholder="e.g. EverSip Persona Study"
                {...register("project_name")}
              />
              {errors.project_name && (
                <p className="text-sm text-red-500">
                  {errors.project_name.message}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-project-description">
                Project Description
              </Label>
              <Input
                data-test-id="EDIT_PROJECT_DESCRIPTION"
                id="edit-project-description"
                placeholder="e.g. EverSip Persona Study is about..."
                {...register("description")}
              />
              {errors.description && (
                <p className="text-sm text-red-500">
                  {errors.description.message}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button
              data-test-id="EDIT_SUBMIT_PROJECT"
              type="submit"
              disabled={isPending}
            >
              {isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditProjectDialog;
