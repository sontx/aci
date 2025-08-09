/* eslint @typescript-eslint/no-explicit-any: 0 */

import SwaggerParser from "@apidevtools/swagger-parser";
import type { OpenAPIV3 } from "openapi-types";
import { FunctionUpsert, HttpMethod } from "@/lib/types/appfunction";

type ParamLocation = "path" | "query" | "header" | "cookie";

type InferRequiredPolicy = "none" | "all" | "nonNullable";

interface VisibleRequiredOptions {
  inferRequired?: InferRequiredPolicy; // default: "none"
  truncateDepth?: number; // default: 2 (levels)
}

const BLACKLIST_FIELDS = ["externalDocs"];

// ---------------- Helpers ----------------

function toUpperSnake(input: string): string {
  const withUnderscores = input
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[-\s/.:]+/g, "_")
    .replace(/[^\w]/g, "_");
  return withUnderscores
    .replace(/__+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function fallbackOperationName(method: string, path: string): string {
  const normalizedPath = path.replace(/[{}]/g, "");
  return toUpperSnake(`${method}_${normalizedPath}`);
}

function toHttpMethod(key: string): HttpMethod | undefined {
  const up = key.toUpperCase();
  const allowed: HttpMethod[] = [
    "GET",
    "POST",
    "PUT",
    "DELETE",
    "PATCH",
    "HEAD",
    "OPTIONS",
  ];
  return (allowed as unknown as string[]).includes(up)
    ? (up as HttpMethod)
    : undefined;
}

function firstJsonLike(
  content?: Record<string, OpenAPIV3.MediaTypeObject>,
): OpenAPIV3.MediaTypeObject | undefined {
  if (!content) return undefined;
  if (content["application/json"]) return content["application/json"];
  const jsonish = Object.keys(content).find((k) => /json$/i.test(k));
  if (jsonish) return content[jsonish];
  return (
    content["application/x-www-form-urlencoded"] ??
    content["multipart/form-data"]
  );
}

function pickServerUrl(
  doc: OpenAPIV3.Document,
  pathItem?: OpenAPIV3.PathItemObject,
  op?: OpenAPIV3.OperationObject,
): string {
  return (
    op?.servers?.[0]?.url ??
    pathItem?.servers?.[0]?.url ??
    doc.servers?.[0]?.url ??
    ""
  );
}

function buildDescription(
  op: OpenAPIV3.OperationObject,
  pathItem?: OpenAPIV3.PathItemObject,
): string {
  const parts = [
    op.summary,
    op.description,
    pathItem?.summary,
    pathItem?.description,
  ]
    .filter(Boolean)
    .map((s) => String(s).trim());
  const seen = new Set<string>();
  const uniq = parts.filter((p) => (seen.has(p) ? false : (seen.add(p), true)));
  return uniq.join(". ");
}

function isNullable(schema: any): boolean {
  if (!schema || typeof schema !== "object") return false;
  if (Array.isArray(schema.type) && schema.type.includes("null")) return true;
  if (schema.nullable === true) return true;
  for (const k of ["oneOf", "anyOf"] as const) {
    const arr = schema[k];
    if (
      Array.isArray(arr) &&
      arr.some((s) =>
        Array.isArray(s?.type) ? s.type.includes("null") : s?.type === "null",
      )
    )
      return true;
  }
  return false;
}

function truncateObjectNode(schema: any) {
  // Keep only a minimal, generic object surface.
  const keep: any = { type: "object", additionalProperties: true };
  // Preserve lightweight annotations if present.
  if (schema?.description) keep.description = schema.description;
  if (schema?.nullable === true) keep.nullable = true;

  // Overwrite in place (so parent references stay valid)
  for (const k of Object.keys(schema)) delete (schema as any)[k];
  Object.assign(schema, keep);
}

function truncateBlacklistFields(schema: any): void {
  // Remove fields that are not needed in a truncated schema
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return;
  }

  for (const field of BLACKLIST_FIELDS) {
    if (field in schema) {
      delete schema[field];
    }
  }
}

function addVisibleRequiredAndTruncate(
  schema: any,
  opts: VisibleRequiredOptions = {},
  visited = new WeakSet<any>(),
  depth = 0,
) {
  truncateBlacklistFields(schema);

  if (!schema || typeof schema !== "object") return;
  if (visited.has(schema)) return;
  visited.add(schema);

  const maxDepth = Number.isFinite(opts.truncateDepth)
    ? (opts.truncateDepth as number)
    : 2;

  // Determine if this node is an object-like schema
  const isObject =
    schema.type === "object" ||
    (Array.isArray(schema.type) && schema.type.includes("object")) ||
    (!!schema.properties && typeof schema.properties === "object");

  if (isObject) {
    if (depth >= maxDepth) {
      // Truncate: remove combinators, heavy structure, and allow arbitrary props
      truncateObjectNode(schema);
      return; // Do not recurse further
    }

    // Add additionalProperties if missing
    if (!("additionalProperties" in schema)) {
      schema.additionalProperties = false;
    }

    // Ensure properties exist if additionalProperties is false
    if (schema.additionalProperties === false && !schema.properties) {
      schema.properties = {};
      schema.required = [];
      schema.visible = [];
    }

    const props =
      schema.properties && typeof schema.properties === "object"
        ? schema.properties
        : undefined;
    const keys = props ? Object.keys(props) : [];

    // Add `visible` if missing
    if (keys.length > 0 && schema.visible === undefined) {
      schema.visible = keys;
    }

    // Add `required` if missing (policy-based)
    if (keys.length > 0 && schema.required === undefined) {
      const policy = opts.inferRequired ?? "none";
      if (policy === "all") {
        schema.required = keys;
      } else if (policy === "nonNullable") {
        const required = keys.filter((k) => {
          const child = props![k];
          const hasDefault = Object.prototype.hasOwnProperty.call(
            child ?? {},
            "default",
          );
          return !isNullable(child) && !hasDefault;
        });
        schema.required = required;
      } else {
        schema.required = [];
      }
    }

    // Recurse into known object-bearing fields
    if (props) {
      for (const v of Object.values(props))
        addVisibleRequiredAndTruncate(v, opts, visited, depth + 1);
    }
    if (
      schema.patternProperties &&
      typeof schema.patternProperties === "object"
    ) {
      for (const v of Object.values(schema.patternProperties)) {
        addVisibleRequiredAndTruncate(v, opts, visited, depth + 1);
      }
    }
    if (
      schema.additionalProperties &&
      typeof schema.additionalProperties === "object"
    ) {
      addVisibleRequiredAndTruncate(
        schema.additionalProperties,
        opts,
        visited,
        depth + 1,
      );
    }
    if (schema.propertyNames && typeof schema.propertyNames === "object") {
      addVisibleRequiredAndTruncate(
        schema.propertyNames,
        opts,
        visited,
        depth + 1,
      );
    }
    if (
      schema.dependentSchemas &&
      typeof schema.dependentSchemas === "object"
    ) {
      for (const v of Object.values(schema.dependentSchemas)) {
        addVisibleRequiredAndTruncate(v, opts, visited, depth + 1);
      }
    }
  }

  // Arrays: recurse into items (depth increases if items are objects)
  if (schema.items) {
    if (Array.isArray(schema.items)) {
      for (const it of schema.items)
        addVisibleRequiredAndTruncate(it, opts, visited, depth + 1);
    } else {
      addVisibleRequiredAndTruncate(schema.items, opts, visited, depth + 1);
    }
  }

  // Combinators: if we’re already at/over the limit, they’ll be removed by truncateObjectNode.
  // Otherwise, traverse them (they might contain objects).
  for (const key of ["allOf", "oneOf", "anyOf"] as const) {
    const arr = schema[key];
    if (Array.isArray(arr)) {
      for (const sub of arr)
        addVisibleRequiredAndTruncate(sub, opts, visited, depth + 1);
    }
  }

  // Conditionals and "not"
  if (schema.if)
    addVisibleRequiredAndTruncate(schema.if, opts, visited, depth + 1);
  if (schema.then)
    addVisibleRequiredAndTruncate(schema.then, opts, visited, depth + 1);
  if (schema.else)
    addVisibleRequiredAndTruncate(schema.else, opts, visited, depth + 1);
  if (schema.not)
    addVisibleRequiredAndTruncate(schema.not, opts, visited, depth + 1);
}

function buildGroupedParametersSchema(
  pathItem: OpenAPIV3.PathItemObject,
  op: OpenAPIV3.OperationObject,
  opts: VisibleRequiredOptions,
): Record<string, any> {
  // Merge pathItem.parameters + op.parameters (op wins on (in,name))
  const allParams = [
    ...(pathItem.parameters ?? []),
    ...(op.parameters ?? []),
  ] as OpenAPIV3.ParameterObject[];
  const merged = new Map<string, OpenAPIV3.ParameterObject>();
  for (const p of allParams) {
    if (!p || !("in" in p) || !("name" in p)) continue;
    merged.set(`${p.in}:${p.name}`, p);
  }

  const groups: Record<
    ParamLocation,
    { required: string[]; props: Record<string, any> }
  > = {
    path: { required: [], props: {} },
    query: { required: [], props: {} },
    header: { required: [], props: {} },
    cookie: { required: [], props: {} },
  };

  for (const p of merged.values()) {
    const loc = p.in as ParamLocation;
    const mt = firstJsonLike((p as any).content);
    const schema = (p.schema ?? mt?.schema ?? {}) as Record<string, any>;
    const desc = p.description ?? schema.description;
    if (desc && !schema.description) schema.description = desc;

    addVisibleRequiredAndTruncate(schema, opts);

    groups[loc].props[p.name] = schema;
    const isRequired = Boolean(p.required || loc === "path");
    if (isRequired) groups[loc].required.push(p.name);
  }

  // Request body
  let bodySchema: Record<string, any> | undefined;
  let bodyRequired = false;
  if (op.requestBody && typeof op.requestBody === "object") {
    const rb = op.requestBody as OpenAPIV3.RequestBodyObject;
    const mt = firstJsonLike(rb.content);
    if (mt?.schema) {
      bodySchema = mt.schema as Record<string, any>;
      bodyRequired = Boolean(rb.required);
      addVisibleRequiredAndTruncate(bodySchema, opts);
    }
  }

  const presentGroups: Array<ParamLocation | "body"> = [];
  const properties: Record<string, any> = {};
  const topLevelRequired: string[] = [];

  (["path", "query", "header", "cookie"] as ParamLocation[]).forEach((loc) => {
    const { props, required } = groups[loc];
    const names = Object.keys(props);
    if (names.length > 0) {
      presentGroups.push(loc);
      properties[loc] = {
        type: "object",
        description:
          loc === "path"
            ? "Path parameters"
            : loc === "query"
              ? "Query parameters"
              : loc === "header"
                ? "Header parameters"
                : "Cookie parameters",
        visible: names, // custom helper field (as in your example)
        required,
        properties: props,
        additionalProperties: false,
      };
      if (required.length > 0) topLevelRequired.push(loc);
    }
  });

  if (bodySchema) {
    presentGroups.push("body");
    properties["body"] = bodySchema;
    if (bodyRequired) topLevelRequired.push("body");
  }

  if (presentGroups.length === 0) return {};
  return {
    type: "object",
    visible: presentGroups,
    required: topLevelRequired,
    properties,
    additionalProperties: false,
  };
}

function buildResponseSchema(
  op: OpenAPIV3.OperationObject,
  opts: VisibleRequiredOptions,
): Record<string, any> {
  const responses = op.responses || {};
  const keys = Object.keys(responses);
  if (keys.length === 0) return {};

  const pickOrder = [
    "200",
    "201",
    "202",
    ...keys.filter(
      (k) => /^2\d\d$/.test(k) && !["200", "201", "202"].includes(k),
    ),
    "default",
  ];

  for (const code of pickOrder) {
    const r = responses[code] as OpenAPIV3.ResponseObject | undefined;
    if (!r) continue;
    const mt = firstJsonLike(r.content);
    if (mt?.schema) {
      const schema = mt.schema as Record<string, any>;
      addVisibleRequiredAndTruncate(schema, opts);
      return schema;
    }
  }
  return {};
}

// ---------------- Main API ----------------

/**
 * Convert an OpenAPI v3 document (object or path/URL) to FunctionUpsert list.
 * By default we **bundle** the spec to keep $refs (avoids circular JSON),
 * but you can set { dereference: true } to fully dereference.
 */
export async function openApiToFunctionUpserts(
  docOrPath: string | OpenAPIV3.Document,
  opts?: { dereference?: boolean; visibleRequired?: VisibleRequiredOptions },
): Promise<FunctionUpsert[]> {
  const parser = new SwaggerParser();
  const bundled: OpenAPIV3.Document = opts?.dereference
    ? ((await parser.dereference(docOrPath as any, {
        dereference: { circular: "ignore" },
      })) as OpenAPIV3.Document)
    : ((await parser.bundle(docOrPath as any)) as OpenAPIV3.Document);

  return convertBundledDoc(bundled, {
    inferRequired: "none",
    truncateDepth: 1,
    ...opts?.visibleRequired,
  });
}

function convertBundledDoc(
  doc: OpenAPIV3.Document,
  opts: VisibleRequiredOptions,
): FunctionUpsert[] {
  const out: FunctionUpsert[] = [];

  for (const [rawPath, pathItem] of Object.entries(doc.paths ?? {})) {
    const pi = pathItem as OpenAPIV3.PathItemObject;
    const entries = Object.entries(pi) as [string, unknown][];

    for (const [methodKey, opAny] of entries) {
      const httpMethod = toHttpMethod(methodKey);
      if (!httpMethod) continue;

      const op = opAny as OpenAPIV3.OperationObject;
      const server_url = pickServerUrl(doc, pi, op);
      const parameters = buildGroupedParametersSchema(pi, op, opts);
      const response = buildResponseSchema(op, opts);
      const description = buildDescription(op, pi);

      const baseName =
        op.operationId?.trim() || fallbackOperationName(httpMethod, rawPath);

      const fn: FunctionUpsert = {
        name: toUpperSnake(baseName),
        description,
        tags: op.tags ?? [],
        visibility: "public",
        active: true,
        protocol: "rest",
        protocol_data: {
          method: httpMethod,
          path: rawPath,
          server_url,
        },
        parameters,
        response,
      };

      out.push(fn);
    }
  }

  return out;
}
