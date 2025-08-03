import axiosInstance from "../axios";
import { OrganizationUser } from "../types/organization";

export async function listOrganizationUsers(): Promise<OrganizationUser[]> {
  const response = await axiosInstance.get("/v1/organizations/users");
  return response.data;
}

export async function inviteToOrganization(
  email: string,
  role: string,
): Promise<void> {
  await axiosInstance.post("/v1/organizations/invite-user", { email, role });
}

export async function removeUser(userId: string): Promise<void> {
  await axiosInstance.delete(`/v1/organizations/users/${userId}`);
}
