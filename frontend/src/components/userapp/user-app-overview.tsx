"use client";

import { UserAppDetails } from "@/lib/types/userapp";
import { Badge } from "@/components/ui/badge";

interface UserAppOverviewProps {
  userApp: UserAppDetails;
}

export function UserAppOverview({ userApp }: UserAppOverviewProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Version
          </label>
          <div className="mt-1">
            <Badge variant="secondary">v{userApp.version}</Badge>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Provider
          </label>
          <div className="mt-1">{userApp.provider}</div>
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Status
          </label>
          <div className="mt-1">
            <Badge variant={userApp.active ? "default" : "destructive"}>
              {userApp.active ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>

        {userApp.categories.length > 0 && (
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Categories
            </label>
            <div className="mt-1 flex flex-wrap gap-2">
              {userApp.categories.map((category) => (
                <Badge key={category} variant="outline" className="text-xs">
                  {category}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {userApp.security_schemes &&
          Object.keys(userApp.security_schemes).length > 0 && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Security Schemes
              </label>
              <div className="mt-1 flex flex-wrap gap-2">
                {Object.keys(userApp.security_schemes).map((scheme) => (
                  <Badge key={scheme} variant="outline" className="text-xs">
                    {scheme}
                  </Badge>
                ))}
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
