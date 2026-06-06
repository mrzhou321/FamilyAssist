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
