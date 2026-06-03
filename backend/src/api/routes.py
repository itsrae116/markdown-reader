from fastapi import APIRouter

from src.models.health import HealthResponse
from src.services.health import get_health

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(code=200, message="success", data=get_health())
