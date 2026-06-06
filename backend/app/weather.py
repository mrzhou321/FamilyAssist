import httpx

from .core.config import settings
from .schemas import WeatherContext


CITY_WEATHER_PRESETS = {
    "guangzhou": WeatherContext(
        city="Guangzhou",
        temperature_c=26,
        condition="cloudy",
        wind="light breeze",
        precipitation_chance=35,
    ),
    "shanghai": WeatherContext(
        city="Shanghai",
        temperature_c=22,
        condition="overcast",
        wind="moderate breeze",
        precipitation_chance=45,
    ),
    "beijing": WeatherContext(
        city="Beijing",
        temperature_c=18,
        condition="clear",
        wind="dry breeze",
        precipitation_chance=10,
    ),
}

CITY_ALIASES = {
    "\u5e7f\u5dde": "guangzhou",
    "guangzhou": "guangzhou",
    "\u4e0a\u6d77": "shanghai",
    "shanghai": "shanghai",
    "\u5317\u4eac": "beijing",
    "beijing": "beijing",
}


def estimate_weather(city: str) -> WeatherContext:
    normalized = city.strip().lower()
    preset_key = CITY_ALIASES.get(normalized, normalized)
    preset = CITY_WEATHER_PRESETS.get(preset_key)
    if preset is not None:
        return preset.model_copy(update={"city": city.strip() or preset.city})

    checksum = sum(ord(char) for char in normalized)
    temperature = 16 + checksum % 12
    precipitation = 15 + checksum % 55
    condition = "light rain" if precipitation >= 55 else "cloudy" if precipitation >= 35 else "clear"
    wind = "moderate breeze" if temperature <= 18 or precipitation >= 55 else "light breeze"
    return WeatherContext(
        city=city.strip() or "Guangzhou",
        temperature_c=temperature,
        condition=condition,
        wind=wind,
        precipitation_chance=precipitation,
    )


async def get_weather_context(city: str, api_key: str = "") -> WeatherContext:
    if not api_key:
        return estimate_weather(city)
    try:
        return await fetch_qweather_now(city, api_key)
    except (httpx.HTTPError, KeyError, ValueError, TypeError):
        return estimate_weather(city)


async def fetch_qweather_now(city: str, api_key: str) -> WeatherContext:
    clean_city = city.strip() or "Guangzhou"
    headers = {"Authorization": f"Bearer {api_key}"}
    async with httpx.AsyncClient(base_url=settings.qweather_api_host, timeout=5.0) as client:
        lookup = await client.get(
            "/geo/v2/city/lookup",
            params={"location": clean_city, "number": 1},
            headers=headers,
        )
        lookup.raise_for_status()
        lookup_data = lookup.json()
        location = lookup_data["location"][0]
        location_id = location["id"]
        display_city = location.get("name") or clean_city

        now_response = await client.get(
            "/v7/weather/now",
            params={"location": location_id},
            headers=headers,
        )
        now_response.raise_for_status()
        now_data = now_response.json()["now"]

    return WeatherContext(
        city=display_city,
        temperature_c=int(float(now_data["temp"])),
        condition=now_data.get("text", ""),
        wind=now_data.get("windDir") or now_data.get("windScale") or "",
        precipitation_chance=_precipitation_from_now(now_data),
        source="qweather",
    )


def _precipitation_from_now(now_data: dict) -> int:
    precip = float(now_data.get("precip", 0) or 0)
    humidity = int(float(now_data.get("humidity", 0) or 0))
    if precip > 0:
        return min(100, max(55, int(precip * 20)))
    if humidity >= 85:
        return 45
    if humidity >= 70:
        return 30
    return 15
