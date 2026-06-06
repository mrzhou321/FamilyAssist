from .schemas import (
    Member,
    Memory,
    Recommendation,
    RecommendationBasisRef,
    RecommendationDomain,
    WeatherContext,
)


def build_recommendation(
    domain: RecommendationDomain,
    member: Member | None,
    memories: list[Memory],
    weather: WeatherContext,
) -> Recommendation:
    related_memories = memories[:5]
    basis = [memory.content for memory in related_memories]
    basis_refs = [
        RecommendationBasisRef(
            memory_id=memory.id,
            source_note_id=memory.source_note_id,
            content=memory.content,
        )
        for memory in related_memories
    ]
    name = member.name if member is not None else "\u5168\u5bb6"
    profile = member.profile if member is not None else None

    if domain == RecommendationDomain.dressing:
        content = _dressing_content(name, profile.thermal_sensitivity if profile else 0, weather)
    elif domain == RecommendationDomain.diet:
        content = _diet_content(
            name,
            profile.diet_restrictions if profile else [],
            profile.allergies if profile else [],
            profile.chronic_conditions if profile else [],
            profile.taste_preference if profile else "",
        )
    else:
        content = _exercise_content(
            name,
            profile.exercise_preference if profile else "",
            profile.injury_history if profile else "",
            weather,
        )

    return Recommendation(domain=domain, content=content, basis=basis, basis_refs=basis_refs)


def build_feedback_memory_content(feedback_content: str, accepted: bool, weather: WeatherContext) -> str:
    verdict = "\u91c7\u7eb3" if accepted else "\u4e0d\u5408\u9002"
    return (
        f"\u7528\u6237\u53cd\u9988\u300c{verdict}\u300d\uff1a{feedback_content}"
        f"\uff08\u5f53\u65e5{weather.city}{weather.temperature_c}\u00b0C\u3001{weather.condition}\uff09"
    )


def _dressing_content(name: str, thermal_sensitivity: int, weather: WeatherContext) -> str:
    if weather.temperature_c <= 18 or thermal_sensitivity < 0:
        layer = "\u957f\u8896\u52a0\u8f7b\u4fbf\u5916\u5957"
    elif weather.temperature_c >= 28 or thermal_sensitivity > 0:
        layer = "\u900f\u6c14\u77ed\u8896\u6216\u8584\u886c\u886b"
    else:
        layer = "\u5355\u5c42\u957f\u8896\u6216\u8584\u4e0a\u8863"

    rain_note = "\uff0c\u5e26\u4f1e\u5e76\u9009\u9632\u6ed1\u978b" if weather.precipitation_chance >= 50 else ""
    return (
        f"{name}\u4eca\u65e5{weather.city}{weather.temperature_c}\u00b0C\u3001{weather.condition}\u3001"
        f"{weather.wind}\uff0c\u5efa\u8bae{layer}{rain_note}\u3002"
    )


def _diet_content(
    name: str,
    diet_restrictions: list[str],
    allergies: list[str],
    chronic_conditions: list[str],
    taste_preference: str,
) -> str:
    avoid = [*diet_restrictions, *allergies]
    avoid_text = "\u3001".join(avoid) if avoid else "\u5df2\u77e5\u5fcc\u53e3"
    chronic_text = "\uff0c\u6ce8\u610f" + "\u3001".join(chronic_conditions) if chronic_conditions else ""
    taste_text = f"\uff0c\u53e3\u5473\u5c3d\u91cf\u8d34\u5408{taste_preference}" if taste_preference else ""
    return (
        f"{name}\u4eca\u65e5\u996e\u98df\u4ee5\u6e05\u6de1\u3001\u5c11\u6cb9\u4e3a\u4e3b\uff0c"
        f"\u907f\u5f00{avoid_text}{chronic_text}{taste_text}\u3002"
    )


def _exercise_content(name: str, exercise_preference: str, injury_history: str, weather: WeatherContext) -> str:
    if weather.precipitation_chance >= 50:
        place = "\u5ba4\u5185"
    elif weather.temperature_c >= 30:
        place = "\u65e9\u665a\u6237\u5916"
    else:
        place = "\u6237\u5916"

    activity = _strip_trailing_punctuation(exercise_preference) or "\u4f4e\u5230\u4e2d\u7b49\u5f3a\u5ea6\u6d3b\u52a8"
    injury = _strip_trailing_punctuation(injury_history)
    injury_note = f"\uff0c\u907f\u514d\u89e6\u53d1\u65e7\u4f24\uff1a{injury}" if injury else ""
    return (
        f"{name}\u4eca\u65e5\u9002\u5408{place}{activity}\uff0c"
        f"\u5929\u6c14\u4e3a{weather.condition}\u3001\u964d\u6c34\u6982\u7387{weather.precipitation_chance}%{injury_note}\u3002"
    )


def _strip_trailing_punctuation(value: str) -> str:
    return value.strip().rstrip("\u3002\uff01\uff1f.!?")


def build_recommendation_query(
    domain: RecommendationDomain,
    member: Member | None,
    weather: WeatherContext,
) -> str:
    name = member.name if member is not None else "\u5168\u5bb6"
    profile = member.profile if member is not None else None
    common = f"{name} {weather.city} {weather.temperature_c}\u00b0C {weather.condition} {weather.wind}"
    if domain == RecommendationDomain.dressing:
        thermal = profile.thermal_sensitivity if profile else 0
        return f"{common} \u7a7f\u8863 \u4f53\u611f \u6015\u51b7 \u6015\u70ed \u6e29\u5ea6 {thermal}"
    if domain == RecommendationDomain.diet:
        restrictions = "\u3001".join(profile.diet_restrictions if profile else [])
        allergies = "\u3001".join(profile.allergies if profile else [])
        chronic = "\u3001".join(profile.chronic_conditions if profile else [])
        taste = profile.taste_preference if profile else ""
        return f"{common} \u996e\u98df \u5fcc\u53e3 \u8fc7\u654f \u6162\u75c5 \u53e3\u5473 {restrictions} {allergies} {chronic} {taste}"
    exercise = profile.exercise_preference if profile else ""
    injury = profile.injury_history if profile else ""
    return f"{common} \u8fd0\u52a8 \u4f24\u75c5 \u4e60\u60ef \u5f3a\u5ea6 {exercise} {injury}"


def recommendation_keywords(domain: RecommendationDomain) -> list[str]:
    if domain == RecommendationDomain.dressing:
        return ["\u7a7f", "\u8863", "\u51b7", "\u70ed", "\u6e29\u5ea6", "\u4fdd\u6696", "\u5916\u5957", "\u8fc7\u654f"]
    if domain == RecommendationDomain.diet:
        return ["\u996e\u98df", "\u5fcc\u53e3", "\u8fc7\u654f", "\u5c11\u7cd6", "\u6e05\u6de1", "\u53e3\u5473", "\u5403"]
    return ["\u8fd0\u52a8", "\u6563\u6b65", "\u819d\u76d6", "\u4f24", "\u75db", "\u8dd1", "\u8df3", "\u5f3a\u5ea6"]
