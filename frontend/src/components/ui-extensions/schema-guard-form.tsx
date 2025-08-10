/* eslint @typescript-eslint/no-explicit-any:0 */

import React, { ChangeEvent, FocusEvent, useCallback } from "react";
import Form from "@rjsf/shadcn";
import { customizeValidator } from "@rjsf/validator-ajv8";
import { Textarea } from "@/components/ui/textarea";
import { IChangeEvent } from "@rjsf/core";
import {
  FormContextType,
  RegistryWidgetsType,
  RJSFSchema,
  StrictRJSFSchema,
  WidgetProps,
} from "@rjsf/utils";

type Props = {
  schema: any; // JSON Schema (may be invalid)
  value: any; // current form value (formData)
  onValueChange: (next: any, isValid: boolean) => void;
};

/** Error boundary to catch runtime rendering errors from RJSF */
class FormErrorBoundary extends React.Component<{
  onCrash: (error: unknown) => void;
  children: React.ReactNode;
}> {
  componentDidCatch(error: unknown) {
    this.props.onCrash(error);
  }

  render() {
    return this.props.children as React.ReactElement;
  }
}

function HiddenErrorList() {
  return null;
}

type CustomWidgetProps<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any,
> = WidgetProps<T, S, F> & {
  options: any;
};
function TextareaWidget<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any,
>({
  id,
  placeholder,
  value,
  required,
  disabled,
  autofocus,
  readonly,
  onBlur,
  onFocus,
  onChange,
  options,
}: CustomWidgetProps<T, S, F>) {
  const _onChange = ({ target: { value } }: ChangeEvent<HTMLTextAreaElement>) =>
    onChange(value === "" ? options.emptyValue : value);
  const _onBlur = ({ target }: FocusEvent<HTMLTextAreaElement>) =>
    onBlur(id, target && target.value);
  const _onFocus = ({ target }: FocusEvent<HTMLTextAreaElement>) =>
    onFocus(id, target && target.value);

  return (
    <Textarea
      id={id}
      name={id}
      placeholder={placeholder}
      disabled={disabled}
      readOnly={readonly}
      value={value ?? ""}
      required={required}
      autoFocus={autofocus}
      rows={1}
      onChange={_onChange}
      onBlur={_onBlur}
      onFocus={_onFocus}
      className="min-h-9"
    />
  );
}

const widgets: RegistryWidgetsType = {
  TextWidget: TextareaWidget,
};

export default function SchemaGuardForm({
  schema,
  value,
  onValueChange,
}: Props) {
  const validator = React.useMemo(
    () =>
      customizeValidator({
        ajvOptionsOverrides: {
          strict: false,
        },
      }),
    [],
  );

  // 1) Validate the schema structure first; if invalid, we’ll show fallback.
  const schemaIsValid = React.useMemo(() => {
    try {
      // Access the underlying AJV instance used by the customized validator
      // @ts-expect-error internal access: customizeValidator attaches `ajv`
      const ajv = validator.ajv as Ajv | undefined;
      if (!ajv) return false;
      return ajv.validateSchema(schema);
    } catch {
      return false;
    }
  }, [schema, validator]);

  // 2) If RJSF crashes at render time, switch to fallback.
  const [crashed, setCrashed] = React.useState(false);

  const handleChange = useCallback(
    (event: IChangeEvent) => {
      onValueChange(event.formData, event.errors.length === 0);
    },
    [onValueChange],
  );

  if (!schemaIsValid || crashed) {
    return <JsonFallback value={value} onValueChange={onValueChange} />;
  }

  return (
    <FormErrorBoundary onCrash={() => setCrashed(true)}>
      <Form
        className="p-4 rounded-lg border"
        schema={schema}
        formData={value}
        validator={validator}
        liveValidate
        // Mirror RJSF's onChange signature, but bubble only the value.
        onChange={handleChange}
        // No-op handlers can be added or customized as needed
        onError={() => {
          /* ignore; RJSF field-level errors */
        }}
        uiSchema={{
          "ui:submitButtonOptions": {
            norender: true,
          },
        }}
        templates={{
          ErrorListTemplate: HiddenErrorList,
        }}
        widgets={widgets}
      />
    </FormErrorBoundary>
  );
}

/** Fallback: a simple JSON textarea editor with basic validation feedback */
function JsonFallback({
  value,
  onValueChange,
}: {
  value: any;
  onValueChange: (next: any, isValid: boolean) => void;
}) {
  const initial = React.useMemo(
    () => (typeof value === "string" ? value : safeStringify(value)),
    [value],
  );
  const [text, setText] = React.useState(initial);
  const [error, setError] = React.useState<string | null>(null);

  const handleBlur = () => {
    try {
      const parsed = JSON.parse(text || "null");
      setError(null);
      onValueChange(parsed, true);
    } catch (e: any) {
      setError(e?.message || "Invalid JSON");
      onValueChange({}, false);
    }
  };

  return (
    <div className="space-y-2">
      <Textarea
        style={{
          fontFamily: "monospace",
          minHeight: 180,
          padding: 8,
          borderRadius: 6,
          border: "1px solid #ccc",
        }}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
        placeholder="Enter JSON here…"
      />
      {error && (
        <div role="alert" style={{ color: "#b00020", fontSize: 12 }}>
          {error}
        </div>
      )}
      <div className="text-xs text-muted-foreground">
        The provided schema could not be rendered. Editing raw JSON instead.
      </div>
    </div>
  );
}

function safeStringify(v: any) {
  try {
    return JSON.stringify(v ?? null, null, 2);
  } catch {
    return "";
  }
}
