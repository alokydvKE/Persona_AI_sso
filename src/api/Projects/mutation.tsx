import { queryClient } from "@/provider";
import { setProjectDelete } from "@/redux/GlobalModalSlice";
import type { AppDispatch } from "@/redux/store";
import { apiRequest } from "@/services/apiService";
import { useMutation } from "@tanstack/react-query";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router";

type CreateProjectPayload = {
  project_name: string;
  project_type: string;
  description: string;
};

type CreateProjectRes = {
  header: ResponseHeader;
  response: {
    project_id: string;
  };
};

export const CreateProject = (cb:()=>void) => {
  const navigate = useNavigate();
  const createProject = useMutation<
    CreateProjectRes,
    Record<string, any>,
    CreateProjectPayload
  >({
    mutationKey: ["CreateProject"],
    mutationFn: async (payload) => {
      const userStr = localStorage.getItem("user");
      const userData = userStr ? JSON.parse(atob(userStr)) : null;
      const token = userData?.token || "";

      const requestPayload = {
        token,
        ...payload,
      };

      const res = await apiRequest("post", "projects/create", requestPayload);
      const data = await res;
      return data.response;
    },
    onSuccess: (response) => {
      // After creating a project, route to the data-file upload step (which
      // runs the background pipeline) before handing off to the builder chat.
      // projectId is in the path so the page survives a refresh.
      const projectId = response.response.project_id;
      navigate(`/upload/${projectId}`, {
        state: {
          projectId,
          fromCreate: true,
        },
      });
      queryClient.invalidateQueries({queryKey:["ProjectList"]})
      cb()
    },
  });

  return createProject;
};

type UpdateProjectPayload = {
  project_id: string;
  project_name: string;
  description?: string;
};

type UpdateProjectRes = {
  header: ResponseHeader;
  response: Record<string, never>;
};

/**
 * POST /v1/projects/update — edit a project's name/description.
 *
 * `status` is intentionally omitted from the payload (not user-editable here).
 * On success the project listing is refreshed via the ["ProjectList"] prefix.
 */
export const UpdateProject = (cb: () => void) => {
  const updateProject = useMutation<
    UpdateProjectRes,
    Record<string, any>,
    UpdateProjectPayload
  >({
    mutationKey: ["UpdateProject"],
    mutationFn: async (payload) => {
      const userStr = localStorage.getItem("user");
      const userData = userStr ? JSON.parse(atob(userStr)) : null;
      const token = userData?.token || "";

      const res = await apiRequest("post", "projects/update", {
        token,
        ...payload,
      });
      return await res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ProjectList"] });
      cb();
    },
  });

  return updateProject;
};

type DeleteProjectPayload = {
  project_id: string;
};

type DeleteProjectRes = {
  header: ResponseHeader;
  response: Record<string, never>;
};

export const DeleteProject = () => {
    const dispatch = useDispatch<AppDispatch>()
  const deleteProject = useMutation<DeleteProjectRes, Record<string, any>, DeleteProjectPayload>({
    mutationKey: ["DeleteProject"],
    mutationFn: async (payload) => {
      const userStr = localStorage.getItem("user");
      const userData = userStr ? JSON.parse(atob(userStr)) : null;
      const token = userData?.token || "";

      const requestPayload = {
        token,
        ...payload,
      };

      const res = await apiRequest("post", "projects/delete", requestPayload);
      const data = await res;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ProjectList"] });
      dispatch(setProjectDelete(null))
    },
  });

  return deleteProject;
};
