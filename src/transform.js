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
  // 1. Merge webhook custom points if they exist
  const webhookPoints = input.points || (input.merge_variables && input.merge_variables.points) || [];
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

  // 2. Get target_year from custom fields (supporting both selected_year and target_year keynames)
  const trmnlSettings = input.plugin_settings || (input.trmnl && input.trmnl.plugin_settings) || {};
  const customValues = trmnlSettings.custom_fields_values || {};
  const selectedYearStr = (customValues.selected_year || customValues.target_year || "").toString().trim();

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
  const xMin = points[0].year;
  const xMax = points[points.length - 1].year;
  const yMax = 1020; // 17 minutes is max safety (bottom)
  
  const marginLeft = 35;
  const marginTop = 10;
  const graphW = 335;
  const graphH = 140;

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

  // 5. Build SVG Path (step chart)
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
  const svgPath = pathParts.join(" ");

  // Highlight dot coordinates
  const [dotX, dotY] = getCoords(selectedYear, activePoint.seconds);

  // 6. Gridlines (Y-axis)
  const gridValues = [
    { seconds: 90, label: "90s" },
    { seconds: 120, label: "2m" },
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
    latest_year: latestYear,
    latest_display_time: formatDisplayTime(points[points.length - 1].seconds),
    latest_clock_face: formatClockFace(points[points.length - 1].seconds),
    latest_reason: points[points.length - 1].reason
  };
}

// Export for environments that use Node module loading
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { run };
}
