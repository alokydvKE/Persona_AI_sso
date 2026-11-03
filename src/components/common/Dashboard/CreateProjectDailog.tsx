import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Label } from "@/components/ui/label";
import {
  CreateProject as CreateProjectT,
  type CreateProjectForm,
} from "@/schemas/Project";
import { Plus } from "lucide-react";
import React from "react";
import { Roles } from "@/data/roles";
import RoleCard from "./RoleCard";
// import { useDispatch } from "react-redux";
// import type { AppDispatch } from "@/redux/store";
// import { setProjects } from "@/redux/ProjectSlice";
// import { formatCurrentDate } from "@/data/DummyFunc";
// import { useNavigate } from "react-router";
import { CreateProject } from "@/api/Projects/mutation";

const CreateProjectDailog = () => {
  const [open, setOpen] = React.useState<boolean>(false);
  const { mutate } = CreateProject(() => setOpen(false));

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<CreateProjectForm>({
    resolver: zodResolver(CreateProjectT),
    defaultValues: {
      project_name: "",
      project_type: "brand_representative",
    },
  });

  const selectedRole = watch("project_type");

  const onSubmit = (data: CreateProjectForm) => {
    mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={"sm"} data-test-id="CREATE">
          <Plus />
          <span className="hidden sm:block">Create Project</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Create Project</DialogTitle>
            <DialogDescription>
              Add a new persona research project to your workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 md:my-4 space-y-2">
            <Label required>Project Type</Label>
            <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4">
              {Roles.map((item) => {
                return (
                  <RoleCard
                    key={item.id}
                    role={item}
                    isSelected={selectedRole === item.id}
                    setSelected={() => setValue("project_type", item.id)}
                  />
                );
              })}
            </div>
            {errors.project_type && (
              <p className="text-sm text-red-500">
                {errors.project_type.message}
              </p>
            )}
          </div>

          <div className="grid gap-4 py-2 md:py-4">
            <div className="grid gap-2">
              <Label htmlFor="title" required>
                Project Title
              </Label>
              <Input
                id="title"
                data-test-id="PROJECT_TITLE"
                placeholder="e.g. EverSip Persona Study"
                {...register("project_name")}
              />
              {errors.project_name && (
                <p className="text-sm text-red-500">
                  {errors.project_name.message}
                </p>
              )}
            </div>
          </div>
          <div className="grid gap-4 py-2 md:py-4">
            <div className="grid gap-2">
              <Label htmlFor="description" required>
                Project Description
              </Label>
              <Input
                data-test-id="PROJECT_DESCRIPTION"
                id="description"
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
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button data-test-id="SUBMIT_PROJECT" type="submit">
              Create Project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateProjectDailog;
