import os

from aci.common.utils import check_and_get_env_variable

AWS_REGION = check_and_get_env_variable("COMMON_AWS_REGION")
AWS_ENDPOINT_URL = check_and_get_env_variable("COMMON_AWS_ENDPOINT_URL")
KEY_ENCRYPTION_KEY_ARN = check_and_get_env_variable("COMMON_KEY_ENCRYPTION_KEY_ARN")
API_KEY_HASHING_SECRET = check_and_get_env_variable("COMMON_API_KEY_HASHING_SECRET")
APP_ORG_PREFIX = os.environ.get("COMMON_APP_ORG_PREFIX", "ORG_")