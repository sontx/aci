"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  APIKeyScheme,
  NoAuthScheme,
  OAuth2Scheme,
  SecurityScheme,
  UserAppUpsert,
} from "@/lib/types/userapp";
import { useCreateUserApp, useUpdateUserApp, useUserApp } from "@/hooks/use-user-app";
import { BasicInfoTab } from "./basic-info-tab";
import { SecurityTab } from "./security-tab";
import { SecuritySchemeConfig } from "./security-scheme-form";
import { toast } from "sonner";
import {
  UserAppFormData,
  userAppSchema,
} from "@/components/userapp/user-app-form/user-app-schema";

interface UserAppFormContentProps {
  userAppName?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function generateAppNameFromDisplayName(displayName: string): string {
  // Convert to snake_case: replace spaces and special chars with underscores
  // Remove multiple underscores and trim
  const snakeCase = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  // Convert to uppercase and add ORG_ prefix
  return snakeCase.toUpperCase();
}

export function UserAppFormContent({
  userAppName,
  onSuccess,
  onCancel,
}: UserAppFormContentProps) {
  const [securitySchemes, setSecuritySchemes] = useState<
    SecuritySchemeConfig[]
  >([]);
  const [generatedName, setGeneratedName] = useState("");
  
  // Fetch user app details if editing
  const { data: userApp, isLoading: isLoadingUserApp } = useUserApp(userAppName);
  const isEditing = !!userAppName;

  const { mutateAsync: createUserApp, isPending: isCreating } =
    useCreateUserApp();
  const { mutateAsync: updateUserApp, isPending: isUpdating } =
    useUpdateUserApp();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<UserAppFormData>({
    resolver: zodResolver(userAppSchema),
    defaultValues: {
      display_name: "",
      provider: "",
      version: "1.0.0",
      description: "",
      logo: "",
      categories: [],
      active: true,
    },
  });

  // Reset form when userApp data is loaded
  useEffect(() => {
    if (userApp && isEditing) {
      reset({
        display_name: userApp.display_name || "",
        provider: userApp.provider || "",
        version: userApp.version || "1.0.0",
        description: userApp.description || "",
        logo: userApp.logo || "",
        categories: userApp.categories || [],
        active: userApp.active ?? true,
      });
    }
  }, [userApp, isEditing, reset]);

  const displayName = watch("display_name");

  // Generate name from display name
  useEffect(() => {
    if (displayName && !isEditing) {
      const generated = generateAppNameFromDisplayName(displayName);
      setGeneratedName(generated);
    }
  }, [displayName, isEditing]);

  // Initialize security schemes from existing user app
  useEffect(() => {
    if (userApp?.security_schemes && isEditing) {
      const schemes: SecuritySchemeConfig[] = Object.entries(
        userApp.security_schemes,
      ).map(([id, scheme]) => ({
        id,
        type: scheme.hasOwnProperty("location")
          ? scheme.hasOwnProperty("client_id")
            ? "oauth2"
            : "api_key"
          : "no_auth",
        config: scheme,
      }));
      setSecuritySchemes(schemes);
    }
  }, [userApp, isEditing]);

  // Show loading state if we're editing and still loading user app data
  if (isEditing && isLoadingUserApp) {
    return (
      <div className="flex items-center justify-center p-6">
        <div>Loading app details...</div>
      </div>
    );
  }

  const onSubmit = async (data: UserAppFormData) => {
    try {
      const security_schemes: Record<
        string,
        APIKeyScheme | OAuth2Scheme | NoAuthScheme
      > = {};

      securitySchemes.forEach((scheme) => {
        security_schemes[scheme.type] = scheme.config;
      });

      const formData: UserAppUpsert = {
        name: isEditing && userApp ? userApp.name : generatedName,
        display_name: data.display_name,
        provider: data.provider,
        version: data.version,
        description: data.description!,
        logo: data.logo!,
        categories: data.categories!,
        visibility: "public", // Always public
        active: data.active,
        security_schemes,
        default_security_credentials_by_scheme: {},
      };

      if (isEditing && userApp) {
        await updateUserApp({
          appName: userApp.name,
          data: formData,
        });
      } else {
        await createUserApp(formData);
      }

      reset();
      onSuccess();
    } catch (error) {
      toast.error(
        `Failed to ${isEditing ? "update" : "create"} user app: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      console.error("Error submitting user app form:", error);
    }
  };

  const addSecurityScheme = (type: SecurityScheme) => {
    // Check for duplicate security scheme types
    const existingTypes = securitySchemes.map((scheme) => scheme.type);
    if (existingTypes.includes(type)) {
      return; // Don't add duplicate types
    }

    const id = `scheme_${Date.now()}`;
    let config: APIKeyScheme | OAuth2Scheme | NoAuthScheme;

    switch (type) {
      case "api_key":
        config = {
          location: "header",
          name: "x-api-key",
          prefix: null,
        };
        break;
      case "oauth2":
        config = {
          location: "header",
          name: "Authorization",
          prefix: "Bearer",
          client_id: "",
          client_secret: "",
          scope: "",
          authorize_url: "",
          access_token_url: "",
          refresh_token_url: "",
          token_endpoint_auth_method: null,
          redirect_url: null,
        };
        break;
      case "no_auth":
      default:
        config = {};
        break;
    }

    setSecuritySchemes([...securitySchemes, { id, type, config }]);
  };

  const updateSecurityScheme = (
    id: string,
    config: APIKeyScheme | OAuth2Scheme | NoAuthScheme,
  ) => {
    setSecuritySchemes((schemes) =>
      schemes.map((scheme) =>
        scheme.id === id ? { ...scheme, config } : scheme,
      ),
    );
  };

  const removeSecurityScheme = (id: string) => {
    setSecuritySchemes((schemes) =>
      schemes.filter((scheme) => scheme.id !== id),
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="basic">Basic Information</TabsTrigger>
          <TabsTrigger value="security">Security Schemes</TabsTrigger>
        </TabsList>

        <TabsContent value="basic">
          <BasicInfoTab
            register={register}
            errors={errors}
            setValue={setValue}
            watch={watch}
            generatedName={generatedName}
            isEditing={isEditing}
            userAppName={userApp?.name}
          />
        </TabsContent>

        <TabsContent value="security">
          <SecurityTab
            securitySchemes={securitySchemes}
            addSecurityScheme={addSecurityScheme}
            updateSecurityScheme={updateSecurityScheme}
            removeSecurityScheme={removeSecurityScheme}
          />
        </TabsContent>
      </Tabs>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isCreating || isUpdating}>
          {isCreating || isUpdating
            ? isEditing
              ? "Updating..."
              : "Creating..."
            : isEditing
              ? "Update App"
              : "Create App"}
        </Button>
      </div>
    </form>
  );
}
