from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://family:family_dev_password@localhost:5432/family_assister"
    ollama_base_url: str = "http://localhost:11434"
    admin_username: str = "admin"
    admin_password: str = "family-admin"
    admin_token_secret: str = "change-me-family-assister"
    debug: bool = False
    require_database: bool = False

    model_config = {"env_file": ".env"}


settings = Settings()
