// TRMNL serverless transform script (JavaScript / Node.js).
//
// Process the Doomsday Clock historical dataset, merge webhook payload updates,
// determine the clock setting at the user-specified target year,
// and calculate coordinates for an SVG step chart representation of the trend.

const DEFAULT_POINTS = [
  {year: 1947, seconds: 420, reason: "Clock established. West-East relations cold."},
  {year: 1949, seconds: 180, reason: "Soviet Union tests its first atomic bomb."},
  {year: 1953, seconds: 120, reason: "US and USSR test thermonuclear devices."},
  {year: 1960, seconds: 420, reason: "Great powers cooperate to avoid nuclear war."},
  {year: 1963, seconds: 720, reason: "US and USSR sign Limited Test Ban Treaty."},
  {year: 1968, seconds: 420, reason: "US involvement in Vietnam intensifies; nuclear arms race increases."},
  {year: 1969, seconds: 600, reason: "US Senate ratifies NPT treaty."},
  {year: 1972, seconds: 720, reason: "US and USSR sign SALT I and ABM treaties."},
  {year: 1974, seconds: 540, reason: "India tests nuclear device; SALT II stalls."},
  {year: 1980, seconds: 420, reason: "US-Soviet talks fade; nationalistic conflicts."},
  {year: 1981, seconds: 240, reason: "Soviet invasion of Afghanistan; US hardline stance."},
  {year: 1984, seconds: 180, reason: "US-Soviet relations at lowest point in decades."},
  {year: 1988, seconds: 360, reason: "US and USSR sign INF treaty; relations improve."},
  {year: 1990, seconds: 600, reason: "Fall of Berlin Wall; democratic movement in Europe."},
  {year: 1991, seconds: 1020, reason: "Strategic Arms Reduction Treaty signed; USSR dissolves."},
  {year: 1995, seconds: 840, reason: "Post-Cold War optimism fades; loose nuclear weapons concern."},
  {year: 1998, seconds: 540, reason: "India and Pakistan test nuclear weapons."},
  {year: 2002, seconds: 420, reason: "US rejects ABM treaty; concern about terrorist nuclear materials."},
  {year: 2007, seconds: 300, reason: "North Korea tests nuclear weapon; climate change added as threat."},
  {year: 2010, seconds: 360, reason: "Worldwide cooperation on nuclear reductions and climate accords."},
  {year: 2012, seconds: 300, reason: "Stalled nuclear disarmament; inadequate climate action."},
  {year: 2015, seconds: 180, reason: "Unchecked climate change; modernizing nuclear arsenals."},
  {year: 2017, seconds: 150, reason: "Rise of nationalism; Trump rhetoric; global security declines."},
  {year: 2018, seconds: 120, reason: "Nuclear rhetoric and modernization; North Korean tensions."},
  {year: 2020, seconds: 100, reason: "Failure of world leaders to address nuclear war and climate change."},
  {year: 2023, seconds: 90, reason: "Russia's invasion of Ukraine; increased nuclear danger; climate crisis."},
  {year: 2024, seconds: 90, reason: "Russia-Ukraine war; Gaza conflict; nuclear modernization; climate inaction."},
  {year: 2026, seconds: 90, reason: "Continued geopolitical instability; rising nuclear and environmental threats."}
];

function formatDisplayTime(seconds) {
  if (seconds <= 100) {
    return `${seconds} seconds`;
  } else {
    const minutes = seconds / 60.0;
    if (Number.isInteger(minutes)) {
      return `${Math.round(minutes)} minutes`;
    } else {
      return `${minutes.toFixed(1)} minutes`;
    }
  }
}

function formatClockFace(seconds) {
  if (seconds <= 0) {
    return "12:00:00 AM";
  }
  const totalSeconds = 12 * 3600 - seconds;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')} PM`;
}

function run(input) {
  try {
    // 1. Merge webhook custom points if they exist
    const webhookPoints = input.points || (input.data && input.data.points) || (input.merge_variables && input.merge_variables.points) || [];
    const pointsDict = {};
    
    DEFAULT_POINTS.forEach(p => {
      pointsDict[p.year] = p;
    });
    
    webhookPoints.forEach(p => {
      const year = parseInt(p.year);
      const seconds = parseInt(p.seconds);
      const reason = p.reason || "";
      if (!isNaN(year) && !isNaN(seconds)) {
        pointsDict[year] = { year, seconds, reason };
      }
    });

    const sortedYears = Object.keys(pointsDict).map(Number).sort((a, b) => a - b);
    const points = sortedYears.map(y => pointsDict[y]);

    // 2. Get target_year from custom fields / webhook payload directly
    const customValues = (input.IDX_0?.custom_fields_values || input.plugin_settings?.custom_fields_values || input.trmnl?.plugin_settings?.custom_fields_values || {});
    const selectedYearStr = (
      input.selected_year || 
      (input.data && input.data.selected_year) ||
      input.target_year || 
      (input.data && input.data.target_year) ||
      customValues.selected_year || 
      customValues.target_year || 
      ""
    ).toString().trim();

    const latestYear = points[points.length - 1].year;
    let selectedYear;
    if (!selectedYearStr || selectedYearStr.toLowerCase() === "latest") {
      selectedYear = latestYear;
    } else {
      selectedYear = parseInt(selectedYearStr);
      if (isNaN(selectedYear)) {
        selectedYear = latestYear;
      }
    }

    // 3. Determine active clock setting at selected_year
    let activePoint = null;
    for (let i = 0; i < points.length; i++) {
      if (points[i].year <= selectedYear) {
        activePoint = points[i];
      } else {
        break;
      }
    }
    if (!activePoint) {
      activePoint = points[0];
    }

    // 4. Generate SVG Coordinates (Graph width=380, height=160)
    const xMin = points.length > 0 ? points[0].year : 1947;
    const xMax = points.length > 0 ? points[points.length - 1].year : 2026;
    const yMax = 1020; // 17 minutes is max safety (bottom)
    
    const marginLeft = 35;
    const marginTop = 5;
    const graphW = 345;
    const graphH = 168;

    function getCoords(yr, sec) {
      let x;
      if (xMax === xMin) {
        x = marginLeft + graphW / 2;
      } else {
        x = marginLeft + graphW * (yr - xMin) / (xMax - xMin);
      }
      const y = marginTop + graphH * sec / yMax;
      return [parseFloat(x.toFixed(1)), parseFloat(y.toFixed(1))];
    }

    // 5. Build SVG Path (step chart) with fallback
    let svgPath = "M 35 100 H 380";
    let dotX = 207.5;
    let dotY = 100;
    let dataUnavailable = false;

    if (points.length >= 2 && xMax > xMin) {
      const pathParts = [];
      points.forEach((p, idx) => {
        const [x, y] = getCoords(p.year, p.seconds);
        if (idx === 0) {
          pathParts.push(`M ${x} ${y}`);
        } else {
          pathParts.push(`H ${x}`);
          pathParts.push(`V ${y}`);
        }
      });

      // Final horizontal stretch to the last year boundary
      const [lastX, lastY] = getCoords(xMax, points[points.length - 1].seconds);
      pathParts.push(`H ${lastX}`);
      svgPath = pathParts.join(" ");

      // Highlight dot coordinates
      const [dX, dY] = getCoords(selectedYear, activePoint.seconds);
      dotX = dX;
      dotY = dY;
    } else {
      dataUnavailable = true;
      if (points.length > 0) {
        const [dX, dY] = getCoords(points[0].year, points[0].seconds);
        dotX = dX;
        dotY = dY;
      }
    }

    // 6. Gridlines (Y-axis)
    const gridValues = [
      { seconds: 90, label: "90s" },
      { seconds: 180, label: "3m" },
      { seconds: 300, label: "5m" },
      { seconds: 600, label: "10m" },
      { seconds: 1020, label: "17m" }
    ];
    const gridLines = gridValues.map(g => {
      const [_, y] = getCoords(xMin, g.seconds);
      return { y, label: g.label };
    });

    // X-axis Labels (Years)
    const xYears = [1950, 1970, 1990, 2010, 2026];
    if (xMax > 2026) {
      xYears.push(xMax);
    }
    const xLabels = xYears.map(yr => {
      const [x, _] = getCoords(yr, 0);
      return { x, label: yr.toString() };
    });

    return {
      selected_year: selectedYear,
      active_year: activePoint.year,
      display_time: formatDisplayTime(activePoint.seconds),
      clock_face: formatClockFace(activePoint.seconds),
      reason: activePoint.reason,
      svg_path: svgPath,
      dot_x: dotX,
      dot_y: dotY,
      grid_lines: gridLines,
      x_labels: xLabels,
      // The latest_* fields represent metadata of the newest clock setting in the dataset.
      // They are consumed by the full & half_horizontal templates and are preserved here for future layout expansions.
      latest_year: latestYear,
      latest_display_time: formatDisplayTime(points[points.length - 1].seconds),
      latest_clock_face: formatClockFace(points[points.length - 1].seconds),
      latest_reason: points[points.length - 1].reason,
      data_unavailable: dataUnavailable
    };
  } catch (err) {
    // Guaranteed safe fallback response structure on any parsing or logic error.
    // Safe guard: check if DEFAULT_POINTS is non-empty to prevent crash if cleared by future maintainers.
    const fallbackPoint = (DEFAULT_POINTS && DEFAULT_POINTS.length > 0)
      ? DEFAULT_POINTS[DEFAULT_POINTS.length - 1]
      : { year: 2026, seconds: 90, reason: "Doomsday Clock setting details are currently unavailable." };

    const xMin = (DEFAULT_POINTS && DEFAULT_POINTS.length > 0) ? DEFAULT_POINTS[0].year : 1947;
    const xMax = (DEFAULT_POINTS && DEFAULT_POINTS.length > 0) ? DEFAULT_POINTS[DEFAULT_POINTS.length - 1].year : 2026;
    const yMax = 1020;
    
    const marginLeft = 35;
    const marginTop = 5;
    const graphW = 345;
    const graphH = 168;

    function getCoords(yr, sec) {
      let x;
      if (xMax === xMin) {
        x = marginLeft + graphW / 2;
      } else {
        x = marginLeft + graphW * (yr - xMin) / (xMax - xMin);
      }
      const y = marginTop + graphH * sec / yMax;
      return [parseFloat(x.toFixed(1)), parseFloat(y.toFixed(1))];
    }

    const gridLines = [
      { seconds: 90, label: "90s" },
      { seconds: 180, label: "3m" },
      { seconds: 300, label: "5m" },
      { seconds: 600, label: "10m" },
      { seconds: 1020, label: "17m" }
    ].map(g => {
      const [_, y] = getCoords(xMin, g.seconds);
      return { y, label: g.label };
    });

    const xYears = [1950, 1970, 1990, 2010, 2026];
    const xLabels = xYears.map(yr => {
      const [x, _] = getCoords(yr, 0);
      return { x, label: yr.toString() };
    });

    const [dotX, dotY] = getCoords(fallbackPoint.year, fallbackPoint.seconds);

    return {
      selected_year: fallbackPoint.year,
      active_year: fallbackPoint.year,
      display_time: formatDisplayTime(fallbackPoint.seconds),
      clock_face: formatClockFace(fallbackPoint.seconds),
      reason: fallbackPoint.reason,
      svg_path: "M 35 100 H 380",
      dot_x: dotX,
      dot_y: dotY,
      grid_lines: gridLines,
      x_labels: xLabels,
      latest_year: fallbackPoint.year,
      latest_display_time: formatDisplayTime(fallbackPoint.seconds),
      latest_clock_face: formatClockFace(fallbackPoint.seconds),
      latest_reason: fallbackPoint.reason,
      data_unavailable: true
    };
  }
}

// Export for environments that use Node module loading
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { run };
}
