import { Project } from "@/lib/types/project";
import axiosInstance from "@/lib/axios";

export async function getProjects(): Promise<Project[]> {
  const response = await axiosInstance.get("/v1/projects");
  return response.data;
}

export async function createProject(
  name: string,
  orgId: string,
): Promise<Project> {
  const response = await axiosInstance.post("/v1/projects", {
    name,
    org_id: orgId,
  });
  return response.data;
}

export async function updateProject(
  projectId: string,
  name: string,
): Promise<Project> {
  const response = await axiosInstance.patch(`/v1/projects/${projectId}`, {
    name,
  });
  return response.data;
}

export async function deleteProject(projectId: string): Promise<void> {
  await axiosInstance.delete(`/v1/projects/${projectId}`);
}
