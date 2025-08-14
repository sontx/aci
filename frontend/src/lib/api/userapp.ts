import {
  BasicFunctionDefinition,
  PagedUserApps,
  UserAppDetails,
  UserAppSearchParams,
  UserAppUpsert,
} from "@/lib/types/userapp";
import axiosInstance from "@/lib/axios";
import {
  AppFunction,
  FunctionUpdate,
  FunctionUpsert,
} from "@/lib/types/appfunction";

export async function getAllUserApps(
  params?: UserAppSearchParams,
): Promise<UserAppDetails[]> {
  const response = await axiosInstance.get("/v1/user-apps", { params });
  return response.data;
}

export async function searchUserApps(
  params?: UserAppSearchParams,
): Promise<PagedUserApps> {
  const response = await axiosInstance.get("/v1/user-apps/search", { params });
  return response.data;
}

export async function getUserApp(appName: string): Promise<UserAppDetails> {
  const response = await axiosInstance.get(`/v1/user-apps/${appName}`);
  return response.data;
}

export async function createUserApp(
  data: UserAppUpsert,
): Promise<UserAppDetails> {
  const response = await axiosInstance.post("/v1/user-apps", data);
  return response.data;
}

export async function updateUserApp(
  appName: string,
  data: UserAppUpsert,
): Promise<UserAppDetails> {
  const response = await axiosInstance.put(`/v1/user-apps/${appName}`, data);
  return response.data;
}

export async function deleteUserApp(appName: string): Promise<void> {
  await axiosInstance.delete(`/v1/user-apps/${appName}`);
}

export async function getUserAppFunctions(
  appName: string,
): Promise<AppFunction[]> {
  const response = await axiosInstance.get(
    `/v1/user-apps/${appName}/functions`,
  );
  return response.data;
}

export async function getUserAppFunction(name: string): Promise<AppFunction> {
  const response = await axiosInstance.get(`/v1/user-functions/${name}`, {
    params: {
      format: "prettier",
    },
  });

  return response.data;
}

export async function createUserAppFunctions(
  userAppName: string,
  functions: FunctionUpsert[],
  overrideExisting = false,
  removePrevious = false,
): Promise<BasicFunctionDefinition[]> {
  const response = await axiosInstance.post(
    `/v1/user-apps/${userAppName}/functions`,
    functions,
    {
      params: {
        override_existing: overrideExisting ? "true" : "false",
        remove_previous: removePrevious ? "true" : "false",
      },
    },
  );

  return response.data;
}

export async function deleteUserAppFunction(name: string): Promise<void> {
  await axiosInstance.delete(`/v1/user-functions/${name}`);
}

export async function updateUserAppFunction(
  functionName: string,
  data: FunctionUpdate,
): Promise<void> {
  await axiosInstance.put(`/v1/user-functions/${functionName}`, data);
}

export async function getAllFunctionTags(): Promise<string[]> {
  const response = await axiosInstance.get<string[]>("/v1/user-functions/tags");
  return response.data;
}
