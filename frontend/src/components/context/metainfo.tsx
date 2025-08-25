"use client";

import { Project } from "@/lib/types/project";
import {
  OrgMemberInfoClass,
  WithLoggedInAuthInfoProps,
  withRequiredAuthInfo,
} from "@propelauth/react";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { UserClass } from "@propelauth/javascript";
import { useProjects, useReloadProjects } from "@/hooks/use-project";
import { useOrgs } from "@/hooks/use-org";
import {
  ACCESS_TOKEN_KEY,
  ACTIVE_ORG_ID_KEY,
  ACTIVE_PROJECT_ID_PREFIX_KEY,
} from "@/lib/constants";

interface MetaInfoContextType {
  user: UserClass;
  orgs: OrgMemberInfoClass[];
  activeOrg: OrgMemberInfoClass;
  setActiveOrg: (org: OrgMemberInfoClass) => void;
  projects: Project[];
  activeProject: Project;
  reloadActiveProject: () => Promise<void>;
  setActiveProject: (project: Project) => void;
  setActiveProjectId: (projectId: string) => void;
  setActiveOrgId: (orgId: string) => void;
  accessToken: string;
}

const MetaInfoContext = createContext<MetaInfoContextType | undefined>(
  undefined,
);

interface MetaInfoProviderProps extends WithLoggedInAuthInfoProps {
  children: ReactNode;
}

export const MetaInfoProvider = withRequiredAuthInfo<MetaInfoProviderProps>(
  ({ children, userClass, accessToken, refreshAuthInfo }) => {
    const [activeOrg, setActiveOrg] = useState<OrgMemberInfoClass | null>(null);
    const [activeProject, setActiveProject] = useState<Project | null>(null);

    const { data: orgs = [], isLoading: orgsLoading } = useOrgs(
      userClass,
      refreshAuthInfo,
    );
    const { data: projects = [], isLoading: projectsLoading } = useProjects(
      activeOrg?.orgId,
      accessToken,
    );
    const reloadProjectsFunc = useReloadProjects();

    // Save access token to local storage
    useEffect(() => {
      if (accessToken) {
        localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      } else {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
      }
    }, [accessToken]);

    useEffect(() => {
      if (orgs.length > 0) {
        // Get active org from local storage
        const savedOrgId = localStorage.getItem(ACTIVE_ORG_ID_KEY);
        const savedOrg = savedOrgId
          ? orgs.find((org) => org.orgId === savedOrgId)
          : null;

        setActiveOrg(savedOrg || orgs[0]);
      }
    }, [orgs]);

    useEffect(() => {
      if (projects.length > 0) {
        const savedProjectId = localStorage.getItem(
          `${ACTIVE_PROJECT_ID_PREFIX_KEY}${activeOrg?.orgId}`,
        );
        const savedProject = savedProjectId
          ? projects.find((p) => p.id === savedProjectId)
          : null;

        setActiveProject(savedProject || projects[0]);
      }
    }, [projects, activeOrg]);

    useEffect(() => {
      if (activeProject && activeOrg) {
        localStorage.setItem(
          `${ACTIVE_PROJECT_ID_PREFIX_KEY}${activeOrg.orgId}`,
          activeProject.id,
        );
      }
    }, [activeProject, activeOrg]);

    useEffect(() => {
      if (activeOrg) {
        localStorage.setItem(ACTIVE_ORG_ID_KEY, activeOrg.orgId);
      } else {
        localStorage.removeItem(ACTIVE_ORG_ID_KEY);
      }
    }, [activeOrg]);

    const handleSetActiveOrg = useCallback((org: OrgMemberInfoClass) => {
      setActiveOrg(org);
      localStorage.setItem(ACTIVE_ORG_ID_KEY, org.orgId);
    }, []);

    const reloadActiveProject = useCallback(async () => {
      if (activeOrg && accessToken) {
        await reloadProjectsFunc(activeOrg.orgId);
      }
    }, [reloadProjectsFunc, activeOrg, accessToken]);

    const setActiveProjectId = useCallback(
      (projectId: string) => {
        const project = projects.find((p) => p.id === projectId);
        if (project) {
          setActiveProject(project);
        }
      },
      [projects],
    );

    const setActiveOrgId = useCallback(
      (orgId: string) => {
        const org = orgs.find((o) => o.orgId === orgId);
        if (org) {
          setActiveOrg(org);
        }
      },
      [orgs],
    );

    return (
      <div>
        {activeOrg &&
        activeProject &&
        accessToken &&
        !projectsLoading &&
        !orgsLoading ? (
          <MetaInfoContext.Provider
            value={{
              user: userClass,
              orgs,
              activeOrg,
              setActiveOrg: handleSetActiveOrg,
              setActiveOrgId,
              projects,
              activeProject,
              setActiveProject,
              setActiveProjectId,
              reloadActiveProject,
              accessToken,
            }}
          >
            {children}
          </MetaInfoContext.Provider>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-screen space-y-3">
            <h1 className="text-2xl font-semibold">
              Setting up your workspace...
            </h1>
            <Skeleton className="h-[125px] w-[250px] rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-[250px]" />
              <Skeleton className="h-4 w-[200px]" />
            </div>
          </div>
        )}
      </div>
    );
  },
);

export const useMetaInfo = () => {
  const context = useContext(MetaInfoContext);
  if (!context) {
    throw new Error("useMetaInfo must be used within a MetaInfoProvider");
  }
  return context;
};
