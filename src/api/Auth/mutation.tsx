import { apiRequest } from "@/services/apiService";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { toast } from "sonner";

type LoginRes = {
    header: ResponseHeader;
    response:{
        token: string
        firstName: string
        lastName:string
    }
}

type LoginPayload = {
    email: string;
    password: string
}

export const Login = () => {
  const navigate = useNavigate()
  const login = useMutation<LoginRes,Record<string, any>, LoginPayload>({
    mutationKey: ["Login"],
    mutationFn: async (payload) => {
      // `credentials`: a 401 here is a rejected sign-in, not an expired
      // session. `silent`: onError toasts every failure, including our own.
      const res = await apiRequest("post", "users/login", payload, "json", {
        credentials: true,
        silent: true,
      });
      const data: LoginRes | undefined = res?.response;
      // Never store a "session" without a token to back it.
      if (!data?.response?.token) {
        throw new Error("We couldn't sign you in. Please try again.");
      }
      return data;
    },
    onSuccess:(data)=>{
        localStorage.setItem("user", btoa(JSON.stringify(data.response)))
        toast.success("Logged in successfully")
        navigate('/dashboard')
    },
    onError: (error) => {
        // One id, so repeated failed attempts replace the toast instead of stacking.
        toast.error(error?.message || "We couldn't sign you in. Please try again.", {
            id: "login-error",
        })
    },
  });

  return login
};

type LogoutPayload = {
  token: string;
}

type LogoutRes = {
  header: ResponseHeader;
  response: {
    message: string;
  }
}

export const Logout = () => {
  const navigate = useNavigate()
  const logout = useMutation<LogoutRes, Record<string, any>, void>({
    mutationKey: ["Logout"],
    mutationFn: async () => {
      const userStr = localStorage.getItem("user");
      const userData = userStr ? JSON.parse(atob(userStr)) : null;
      const token = userData?.token || "";
      
      const payload: LogoutPayload = { token };
      const res = await apiRequest("post", "users/logout", payload);
      const data = await res;
      return data.response;
    },
    onSuccess: () => {
      localStorage.clear();
      navigate('/')
    }
  });

  return logout;
};