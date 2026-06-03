from src.models.health import HealthData


def get_health() -> HealthData:
    return HealthData(status="ok", service="markdown-reader")
