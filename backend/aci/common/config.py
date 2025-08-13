import os

from aci.common.utils import check_and_get_env_variable

AWS_REGION = check_and_get_env_variable("COMMON_AWS_REGION")
ENCRYPTION_KEYS = check_and_get_env_variable("COMMON_ENCRYPTION_KEYS", True)
CURRENT_KEY_ID = check_and_get_env_variable("COMMON_CURRENT_KEY_ID")
API_KEY_HASHING_SECRET = check_and_get_env_variable("COMMON_API_KEY_HASHING_SECRET")
APP_ORG_PREFIX = os.environ.get("COMMON_APP_ORG_PREFIX", "ORG_")