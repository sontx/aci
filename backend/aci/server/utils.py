import json

from aci.common import processor
from aci.common.db.sql_models import Function
from aci.common.enums import FunctionDefinitionFormat
from aci.common.exceptions import InvalidFunctionDefinitionFormat
from aci.common.jsonschema_markdown import generate_jsonschema_to_markdown
from aci.common.schemas.function import BasicFunctionDefinition, OpenAIFunctionDefinition, \
    OpenAIResponsesFunctionDefinition, AnthropicFunctionDefinition, OpenAIFunction, FunctionDetails, \
    generate_display_name


def truncate_if_too_large(data: str, max_size: int) -> str:
    data_size = len(data.encode("utf-8"))
    if data_size > max_size:
        return (
                data.encode("utf-8")[: max_size - 100].decode("utf-8", errors="replace")
                + f"... [truncated, size={data_size}]"
        )
    return data


def format_function_definition(
        function: Function, format: FunctionDefinitionFormat
) -> (
        BasicFunctionDefinition
        | OpenAIFunctionDefinition
        | OpenAIResponsesFunctionDefinition
        | AnthropicFunctionDefinition
        | FunctionDetails
):
    match format:
        case FunctionDefinitionFormat.PRETTIER:
            parameter_markdown = generate_jsonschema_to_markdown(function.parameters) if function.parameters else ""
            response_markdown = generate_jsonschema_to_markdown(function.response) if function.response else ""
            return FunctionDetails(
                id=function.id,
                app_name=function.app_name,
                name=function.name,
                description=function.description,
                tags=function.tags,
                visibility=function.visibility,
                active=function.active,
                protocol=function.protocol,
                protocol_data=function.protocol_data,
                response=response_markdown,
                parameters=parameter_markdown,
                created_at=function.created_at,
                updated_at=function.updated_at,
            )
        case FunctionDefinitionFormat.RAW:
            parameter_markdown = json.dumps(function.parameters) if function.parameters else ""
            response_markdown = json.dumps(function.response) if function.response else ""
            return FunctionDetails(
                id=function.id,
                app_name=function.app_name,
                name=function.name,
                description=function.description,
                tags=function.tags,
                visibility=function.visibility,
                active=function.active,
                protocol=function.protocol,
                protocol_data=function.protocol_data,
                response=response_markdown,
                parameters=parameter_markdown,
                created_at=function.created_at,
                updated_at=function.updated_at,
            )
        case FunctionDefinitionFormat.BASIC:
            return BasicFunctionDefinition(
                name=function.name,
                description=function.description,
                tags=function.tags,
                display_name=generate_display_name(app_name=function.app_name, function_name=function.name),
            )
        case FunctionDefinitionFormat.OPENAI:
            return OpenAIFunctionDefinition(
                function=OpenAIFunction(
                    name=function.name,
                    description=function.description,
                    parameters=processor.filter_visible_properties(function.parameters),
                )
            )
        case FunctionDefinitionFormat.OPENAI_RESPONSES:
            # Create a properly formatted OpenAIResponsesFunctionDefinition
            # This format is used by the OpenAI chat completions API
            return OpenAIResponsesFunctionDefinition(
                type="function",
                name=function.name,
                description=function.description,
                parameters=processor.filter_visible_properties(function.parameters),
            )
        case FunctionDefinitionFormat.ANTHROPIC:
            return AnthropicFunctionDefinition(
                name=function.name,
                description=function.description,
                input_schema=processor.filter_visible_properties(function.parameters),
            )
        case _:
            raise InvalidFunctionDefinitionFormat(f"Invalid format: {format}")
