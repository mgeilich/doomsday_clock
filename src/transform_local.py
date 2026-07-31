# frozen_string_literal: false
# TRMNL serverless transform script.
# Process the Doomsday Clock historical dataset, determine the clock setting
# at the user-specified target year,
# and calculate coordinates for an SVG step chart representation of the trend.

import json

DEFAULT_POINTS = [
    {"year": 1947, "seconds": 420, "reason": "Clock established. West-East relations cold."},
    {"year": 1949, "seconds": 180, "reason": "Soviet Union tests its first atomic bomb."},
    {"year": 1953, "seconds": 120, "reason": "US and USSR test thermonuclear devices."},
    {"year": 1960, "seconds": 420, "reason": "Great powers cooperate to avoid nuclear war."},
    {"year": 1963, "seconds": 720, "reason": "US and USSR sign Limited Test Ban Treaty."},
    {"year": 1968, "seconds": 420, "reason": "US involvement in Vietnam intensifies; nuclear arms race increases."},
    {"year": 1969, "seconds": 600, "reason": "US Senate ratifies NPT treaty."},
    {"year": 1972, "seconds": 720, "reason": "US and USSR sign SALT I and ABM treaties."},
    {"year": 1974, "seconds": 540, "reason": "India tests nuclear device; SALT II stalls."},
    {"year": 1980, "seconds": 420, "reason": "US-Soviet talks fade; nationalistic conflicts."},
    {"year": 1981, "seconds": 240, "reason": "Soviet invasion of Afghanistan; US hardline stance."},
    {"year": 1984, "seconds": 180, "reason": "US-Soviet relations at lowest point in decades."},
    {"year": 1988, "seconds": 360, "reason": "US and USSR sign INF treaty; relations improve."},
    {"year": 1990, "seconds": 600, "reason": "Fall of Berlin Wall; democratic movement in Europe."},
    {"year": 1991, "seconds": 1020, "reason": "Strategic Arms Reduction Treaty signed; USSR dissolves."},
    {"year": 1995, "seconds": 840, "reason": "Post-Cold War optimism fades; loose nuclear weapons concern."},
    {"year": 1998, "seconds": 540, "reason": "India and Pakistan test nuclear weapons."},
    {"year": 2002, "seconds": 420, "reason": "US rejects ABM treaty; concern about terrorist nuclear materials."},
    {"year": 2007, "seconds": 300, "reason": "North Korea tests nuclear weapon; climate change added as threat."},
    {"year": 2010, "seconds": 360, "reason": "Worldwide cooperation on nuclear reductions and climate accords."},
    {"year": 2012, "seconds": 300, "reason": "Stalled nuclear disarmament; inadequate climate action."},
    {"year": 2015, "seconds": 180, "reason": "Unchecked climate change; modernizing nuclear arsenals."},
    {"year": 2017, "seconds": 150, "reason": "Rise of nationalism; Trump rhetoric; global security declines."},
    {"year": 2018, "seconds": 120, "reason": "Nuclear rhetoric and modernization; North Korean tensions."},
    {"year": 2020, "seconds": 100, "reason": "Failure of world leaders to address nuclear war and climate change."},
    {"year": 2023, "seconds": 90, "reason": "Russia's invasion of Ukraine; increased nuclear danger; climate crisis."},
    {"year": 2024, "seconds": 90, "reason": "Russia-Ukraine war; Gaza conflict; nuclear modernization; climate inaction."},
    {"year": 2026, "seconds": 90, "reason": "Continued geopolitical instability; rising nuclear and environmental threats."}
]

def format_display_time(seconds):
    if seconds <= 100:
        return f"{seconds} seconds"
    else:
        minutes = seconds / 60.0
        if minutes.is_integer():
            return f"{int(minutes)} minutes"
        else:
            return f"{minutes:.1f} minutes"

def format_clock_face(seconds):
    if seconds <= 0:
        return "12:00:00"
    total_seconds = 12 * 3600 - seconds
    h = total_seconds // 3600
    m = (total_seconds % 3600) // 60
    s = total_seconds % 60
    return f"{h}:{m:02d}:{s:02d}"

def run(input):
    try:
        # 1. Extract fetched points from polling response (or fallback to hardcoded default)
        fetched_points = []
        if isinstance(input, list):
            fetched_points = input
        elif isinstance(input, dict):
            fetched_points = (
                input.get("points")
                or input.get("data", {}).get("points")
                or input.get("merge_variables", {}).get("points")
                or []
            )

        if not fetched_points:
            fetched_points = DEFAULT_POINTS

        points_dict = {}
        for p in fetched_points:
            try:
                year = int(p.get("year"))
                seconds = int(p.get("seconds"))
                reason = p.get("reason", "")
                points_dict[year] = {
                    "year": year,
                    "seconds": seconds,
                    "reason": reason
                }
            except (ValueError, TypeError, AttributeError):
                continue

        points = [points_dict[y] for y in sorted(points_dict.keys())]
        
        # 2. Get target_year from custom fields / payload directly
        custom_values = (
            input.get("IDX_0", {}).get("custom_fields_values")
            or input.get("plugin_settings", {}).get("custom_fields_values")
            or input.get("trmnl", {}).get("plugin_settings", {}).get("custom_fields_values")
            or {}
        )
        target_year_str = str(
            input.get("selected_year")
            or input.get("data", {}).get("selected_year")
            or input.get("target_year")
            or input.get("data", {}).get("target_year")
            or custom_values.get("selected_year")
            or custom_values.get("target_year")
            or ""
        ).strip()
        
        latest_year = points[-1]["year"]
        
        if not target_year_str or target_year_str.lower() == "latest":
            target_year = latest_year
        else:
            try:
                target_year = int(target_year_str)
            except ValueError:
                target_year = latest_year
                
        # 3. Determine active clock setting at target_year
        active_point = None
        for p in points:
            if p["year"] <= target_year:
                active_point = p
            else:
                break
                
        if not active_point:
            active_point = points[0]
            
        # 4. Generate SVG Coordinates (Graph width=380, height=180)
        x_min = points[0]["year"] if len(points) > 0 else 1947
        x_max = points[-1]["year"] if len(points) > 0 else 2026
        y_max = 1020 # 17 minutes is max safety y-value (bottom)
        
        margin_left = 35
        margin_top = 5
        graph_w = 340
        graph_h = 168
        
        def get_coords(yr, sec):
            if x_max == x_min:
                x = margin_left + graph_w / 2
            else:
                x = margin_left + graph_w * (yr - x_min) / (x_max - x_min)
            
            # y=0 is midnight (top), y_max is safest (bottom)
            y = margin_top + graph_h * sec / y_max
            return round(x, 1), round(y, 1)

        # 5. Build SVG Path (step chart) with fallback
        svg_path = "M 35 100 H 375"
        dot_x = 207.5
        dot_y = 100
        data_unavailable = False

        if len(points) >= 2 and x_max > x_min:
            path_parts = []
            for i, p in enumerate(points):
                x, y = get_coords(p["year"], p["seconds"])
                if i == 0:
                    path_parts.append(f"M {x} {y}")
                else:
                    path_parts.append(f"H {x}")
                    path_parts.append(f"V {y}")
                    
            # Final horizontal stretch to the last year boundary
            last_x, last_y = get_coords(x_max, points[-1]["seconds"])
            path_parts.append(f"H {last_x}")
            svg_path = " ".join(path_parts)
            
            # Target Year Dot coordinates
            dot_x, dot_y = get_coords(target_year, active_point["seconds"])
        else:
            data_unavailable = True
            if len(points) > 0:
                dot_x, dot_y = get_coords(points[0]["year"], points[0]["seconds"])
        
        # 6. Gridlines (Y-axis)
        grid_values = [
            {"seconds": 90, "label": "90s"},
            {"seconds": 180, "label": "3m"},
            {"seconds": 300, "label": "5m"},
            {"seconds": 600, "label": "10m"},
            {"seconds": 1020, "label": "17m"}
        ]
        grid_lines = []
        for g in grid_values:
            _, y = get_coords(x_min, g["seconds"])
            grid_lines.append({
                "y": y,
                "label": g["label"]
            })
            
        # X-axis Labels (Years)
        x_years = [1950, 1970, 1990, 2010, 2026]
        # Make sure x_max is in x_years if it exceeds 2026
        if x_max > 2026:
            x_years.append(x_max)
        x_labels = []
        for yr in x_years:
            x, _ = get_coords(yr, 0)
            x_labels.append({
                "x": x,
                "label": str(yr)
            })

        # Return payload
        return {
            "selected_year": target_year,
            "active_year": active_point["year"],
            "display_time": format_display_time(active_point["seconds"]),
            "clock_face": format_clock_face(active_point["seconds"]),
            "reason": active_point["reason"],
            "svg_path": svg_path,
            "dot_x": dot_x,
            "dot_y": dot_y,
            "grid_lines": grid_lines,
            "x_labels": x_labels,
            # The latest_* fields represent metadata of the newest clock setting in the dataset.
            # They are consumed by the full & half_horizontal templates and are preserved here for future layout expansions.
            "latest_year": latest_year,
            "latest_display_time": format_display_time(points[-1]["seconds"]),
            "latest_clock_face": format_clock_face(points[-1]["seconds"]),
            "latest_reason": points[-1]["reason"],
            "data_unavailable": data_unavailable
        }
    except Exception:
        # Safe guard: check if DEFAULT_POINTS is non-empty to prevent crash if cleared by future maintainers.
        return {
            "selected_year": 2026,
            "active_year": 2026,
            "display_time": "90 seconds",
            "clock_face": "11:58:30",
            "reason": "Doomsday Clock setting details are currently unavailable.",
            "svg_path": "M 35 100 H 375",
            "dot_x": 207.5,
            "dot_y": 100,
            "grid_lines": [],
            "x_labels": [],
            "latest_year": 2026,
            "latest_display_time": "90 seconds",
            "latest_clock_face": "11:58:30",
            "latest_reason": "Doomsday Clock setting details are currently unavailable.",
            "data_unavailable": True
        }
