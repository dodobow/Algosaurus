import re
from urllib.parse import quote

from .api import ApiError


def handle_value(value):
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9_]{1,64}", value):
        raise ApiError(400, "INVALID_HANDLE", "solved.ac 핸들은 영문·숫자·밑줄 1~64자로 입력해 줘.")
    if value.lower() == "me":
        raise ApiError(400, "RESERVED_HANDLE", "검색에서 me는 로그인 계정을 뜻해서 이 핸들은 지원하지 않아.")
    return value


class Service:
    def __init__(self, api):
        self.api = api

    def profile(self, handle):
        data = self.api.get("/users/" + quote(handle_value(handle), safe=""))
        if (not isinstance(data.get("id"), int) or not isinstance(data.get("handle"), str)
                or not isinstance(data.get("ojAccounts"), list)
                or not isinstance(data.get("rating"), int)
                or data.get("tier") is not None and not isinstance(data.get("tier"), int)):
            raise ApiError(502, "INVALID_PROFILE", "프로필 응답에 필요한 정보가 없어.")
        return data
