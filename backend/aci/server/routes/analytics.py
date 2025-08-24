from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends
from logfire.experimental.query_client import AsyncLogfireQueryClient
from sqlalchemy import text

from aci.common.db import crud
from aci.common.logging_setup import get_logger
from aci.common.schemas.analytics import DistributionDatapoint, TimeSeriesDatapoint
from aci.server import config
from aci.server import dependencies as deps

router = APIRouter()
logger = get_logger(__name__)


async def _get_project_api_key_ids_sql_list(context: deps.RequestContext) -> str | None:
    project_api_key_ids = await crud.projects.get_all_api_key_ids_for_project(
        context.db_session, context.project.id
    )

    if not project_api_key_ids:
        return None

    return ",".join(f"'{key_id}'" for key_id in project_api_key_ids)


@router.get("/app-usage-distribution", response_model=list[DistributionDatapoint])
async def get_app_usage_distribution(
        context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
) -> list[DistributionDatapoint]:
    api_key_ids_sql_list = await _get_project_api_key_ids_sql_list(context)

    if not api_key_ids_sql_list:
        return []

    query = f"""
SELECT
  regexp_replace(url_path, '/v1/functions/([^/]+?)(?:__.*)?/execute', '\\1') AS name,
  COUNT(*) AS value
FROM records
WHERE attributes->>'http.user_agent' LIKE '%python%'
  AND attributes->>'fastapi.route.name' = 'execute'
  AND trace_id IN (SELECT trace_id FROM records
WHERE attributes->>'api_key_id' IN ({api_key_ids_sql_list}))
GROUP BY name
ORDER BY value DESC;
    """

    async with AsyncLogfireQueryClient(read_token=config.LOGFIRE_READ_TOKEN) as client:
        json_rows = await client.query_json_rows(
            sql=query, min_timestamp=datetime.now() - timedelta(days=7)
        )
        return [DistributionDatapoint(**row) for row in json_rows["rows"]]


@router.get("/function-usage-distribution", response_model=list[DistributionDatapoint])
async def get_function_usage_distribution(
        context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
) -> list[DistributionDatapoint]:
    api_key_ids_sql_list = await _get_project_api_key_ids_sql_list(context)

    if not api_key_ids_sql_list:
        return []

    query = f"""
SELECT
  regexp_replace(url_path, '/v1/functions/([A-Z0-9_]+)/execute', '\\1') AS name,
  COUNT(*) AS value
FROM records
WHERE attributes->>'http.user_agent' LIKE '%python%'
  AND attributes->>'fastapi.route.name' = 'execute'
  AND trace_id IN (SELECT trace_id FROM records
WHERE attributes->>'api_key_id' IN ({api_key_ids_sql_list}))
GROUP BY name
ORDER BY value DESC;
    """

    async with AsyncLogfireQueryClient(read_token=config.LOGFIRE_READ_TOKEN) as client:
        json_rows = await client.query_json_rows(
            sql=query, min_timestamp=datetime.now() - timedelta(days=7)
        )
        return [DistributionDatapoint(**row) for row in json_rows["rows"]]


@router.get("/app-usage-timeseries", response_model=list[TimeSeriesDatapoint])
async def get_app_usage_timeseries(
        context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
) -> list[TimeSeriesDatapoint]:
    """Get app usage over time from execution logs table."""

    # Query execution logs from today's partition table
    # Use raw SQL to query the specific partition with minute-level accuracy
    query = text("""
                 SELECT DATE_TRUNC('minute', created_at) as date,
                        app_name,
                        COUNT(*)                         as amount
                 FROM execution_logs_today
                 WHERE project_id = :project_id
                 GROUP BY DATE_TRUNC('minute', created_at), app_name
                 ORDER BY date DESC
                 """)

    result = await context.db_session.execute(query, {"project_id": str(context.project.id)})
    results = result.fetchall()

    # Transform the data format similar to app usage timeseries
    date_grouped = {}
    for row in results:
        date_str = row.date.strftime('%Y-%m-%d %H:%M')  # Include minute for precise timing
        app_name = row.app_name
        amount = row.amount

        if date_str not in date_grouped:
            date_grouped[date_str] = {"date": date_str}

        date_grouped[date_str][app_name] = amount

    # Convert to list format and use the TimeSeriesDatapoint model
    return [TimeSeriesDatapoint(**data) for data in date_grouped.values()]


@router.get("/function-usage-timeseries", response_model=list[TimeSeriesDatapoint])
async def get_function_usage_timeseries(
        context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
) -> list[TimeSeriesDatapoint]:
    """Get function usage over time from execution logs table."""

    # Query execution logs from today's partition table
    # Use raw SQL to query the specific partition with minute-level accuracy
    query = text("""
                 SELECT DATE_TRUNC('minute', created_at) as date,
                        function_name,
                        COUNT(*)                         as amount
                 FROM execution_logs_today
                 WHERE project_id = :project_id
                 GROUP BY DATE_TRUNC('minute', created_at), function_name
                 ORDER BY date DESC
                 """)

    result = await context.db_session.execute(query, {"project_id": str(context.project.id)})
    results = result.fetchall()

    # Transform the data format similar to app usage timeseries
    date_grouped = {}
    for row in results:
        date_str = row.date.strftime('%Y-%m-%d %H:%M')  # Include minute for precise timing
        function_name = row.function_name
        amount = row.amount

        if date_str not in date_grouped:
            date_grouped[date_str] = {"date": date_str}

        date_grouped[date_str][function_name] = amount

    # Convert to list format and use the TimeSeriesDatapoint model
    return [TimeSeriesDatapoint(**data) for data in date_grouped.values()]
