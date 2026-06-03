from pydantic import BaseModel


class HealthData(BaseModel):
    status: str
    service: str


class HealthResponse(BaseModel):
    code: int
    message: str
    data: HealthData
