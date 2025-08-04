import axios from "axios";
import {
  getStorageAccessToken,
  getStorageActiveOrgId,
  getStorageActiveProjectId,
} from "@/lib/utils";

const axiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 10000,
  paramsSerializer: {
    indexes: null, // ensures `q=apple&q=banana&q=cherry`
  },
});

// Token injection via request interceptor
axiosInstance.interceptors.request.use(
  (config) => {
    const token = getStorageAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const orgId = getStorageActiveOrgId();
    if (orgId) {
      config.headers["X-ORG-ID"] = orgId;
      const activeProjectId = getStorageActiveProjectId(orgId);
      if (activeProjectId) {
        config.headers["X-PROJECT-ID"] = activeProjectId;
      }
    }

    return config;
  },
  (error) => Promise.reject(error),
);

export default axiosInstance;
