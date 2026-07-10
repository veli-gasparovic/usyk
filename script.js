// Initialize Mixpanel
mixpanel.init("af7a3b5acec336f429aba394a5ad602c");

// Validated accent pair on the dark surface (#1a1a19):
// gold #c98500 + red #e66767 — CVD deltaE 35.9, both >= 3:1 contrast
const INK = {
  gold: "#c98500",
  goldBright: "#eda100",
  loss: "#e66767",
  primary: "#ffffff",
  secondary: "#c3c2b7",
  muted: "#898781",
  hairline: "#2c2c2a",
  surface: "#1a1a19",
};

const PRE_OPACITY = 0.18; // career before the Usyk fight
const POST_OPACITY = 0.07; // career after the Usyk fight

class BoxingRecordsChart {
  constructor() {
    this.margin = { top: 26, right: 36, bottom: 20, left: 28 };
    this.svg = d3.select("#chart");
    this.tooltip = this.createTooltip();
    this.verticalOrder = true; // Set to true for date-based vertical ordering, false for equal spacing
    this.hasAnimated = false;
    this.reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    this.init();
  }

  init() {
    window.addEventListener("resize", () => this.resize());
    this.resize();
    this.loadData();
  }

  resize() {
    const container = document.getElementById("chart-container");
    const containerRect = container.getBoundingClientRect();

    this.width = containerRect.width - this.margin.left - this.margin.right;
    this.height = containerRect.height - this.margin.top - this.margin.bottom;

    this.svg
      .attr("width", containerRect.width)
      .attr("height", containerRect.height);

    if (this.data) {
      this.render();
    }
  }

  createTooltip() {
    return d3.select("body").append("div").attr("class", "tooltip");
  }

  async loadData() {
    // Load actual CSV data
    this.data = await this.loadCSVData("bouts.csv");
    console.log("Loaded data:", this.data);
    this.processData();
    this.renderStats();
    this.renderTable();
    this.render();

    // Track successful data load
    mixpanel.track("Data Loaded Successfully", {
      dataSource: "CSV",
      fightersCount: this.data.length,
    });
  }

  processData() {
    // Find Usyk's data
    const usykData = this.data.find(
      (boxer) => boxer.boxer === "Oleksandr Usyk"
    );
    if (!usykData) {
      console.error("Usyk data not found!");
      return;
    }

    // Define a fixed X position for all Usyk fights (e.g., middle of the chart)
    const USYK_FIGHT_X = 15; // Fixed X position for alignment

    // Filter out Usyk and calculate where each fighter's Usyk fight would be
    const fightersWithUsyk = this.data.filter(
      (boxerData) =>
        boxerData.boxer !== "Oleksandr Usyk" &&
        boxerData.fights.some((fight) => fight.opponent === "Oleksandr Usyk")
    );

    // First pass: calculate each fighter's record at EACH Usyk fight (create multiple trajectories)
    const fightersWithUsykPositions = [];

    fightersWithUsyk.forEach((boxerData) => {
      const fights = boxerData.fights;

      // Find ALL Usyk fights for this boxer
      fights.forEach((fight, index) => {
        if (fight.opponent === "Oleksandr Usyk") {
          // Cumulative record up to (but not including) this specific Usyk fight
          let recordAtUsyk = 0;
          let preW = 0;
          let preL = 0;
          for (let i = 0; i < index; i++) {
            const prevFight = fights[i];
            if (prevFight.result === "Win" || prevFight.result === "W") {
              recordAtUsyk += 1;
              preW += 1;
            } else if (
              prevFight.result === "Loss" ||
              prevFight.result === "L"
            ) {
              recordAtUsyk -= 1;
              preL += 1;
            }
          }

          // Count how many Usyk fights this boxer has had
          const totalUsykFights = fights.filter(
            (f) => f.opponent === "Oleksandr Usyk"
          ).length;
          const usykFightNumber = fights
            .slice(0, index + 1)
            .filter((f) => f.opponent === "Oleksandr Usyk").length;

          fightersWithUsykPositions.push({
            ...boxerData,
            usykFightIndex: index,
            recordAtUsyk,
            preW,
            preL,
            originalBoxer: boxerData.boxer, // Store original name for color mapping
            boxer:
              totalUsykFights > 1
                ? `${boxerData.boxer} (${usykFightNumber})`
                : boxerData.boxer,
            usykFightDate: fight.date, // Store the date of this specific Usyk fight for sorting
            usykFight: fight,
          });
        }
      });
    });

    // Sort all trajectories by the date of their respective Usyk fight
    fightersWithUsykPositions.sort(
      (a, b) => new Date(a.usykFightDate) - new Date(b.usykFightDate)
    );

    // Configure vertical positioning for the Usyk segments
    let targetUsykYFunction;

    if (this.verticalOrder) {
      // Date-based Y positioning
      const allUsykDates = fightersWithUsykPositions.map(
        (d) => new Date(d.usykFightDate)
      );
      const dateExtent = d3.extent(allUsykDates);
      const dateYScale = d3.scaleTime().domain(dateExtent).range([-20, 20]);
      // Entries are date-sorted, so a forward pass enforcing a minimum gap
      // resolves overlaps while preserving chronological order
      const minGap = 1.3;
      this.minGap = minGap;
      const targetYs = fightersWithUsykPositions.map((d) =>
        dateYScale(new Date(d.usykFightDate))
      );
      for (let i = 1; i < targetYs.length; i++) {
        if (targetYs[i] - targetYs[i - 1] < minGap) {
          targetYs[i] = targetYs[i - 1] + minGap;
        }
      }
      targetUsykYFunction = (boxerData, index) => targetYs[index];
    } else {
      // Equal spacing
      const spacing = 2; // Vertical spacing between Usyk segments
      const totalHeight = (fightersWithUsykPositions.length - 1) * spacing;
      const baseUsykY = -totalHeight / 2;
      targetUsykYFunction = (boxerData, index) => baseUsykY + index * spacing;
    }

    this.processedData = fightersWithUsykPositions.map((boxerData, index) => {
      const fights = boxerData.fights;
      const targetUsykY = targetUsykYFunction(boxerData, index);

      // Calculate starting position to achieve target Usyk Y position
      const startingY = targetUsykY - boxerData.recordAtUsyk;
      let cumulativeRecord = startingY;
      let cumW = 0;
      let cumL = 0;
      const points = [];

      // Use the specific Usyk fight index for this trajectory
      const usykFightIndex = boxerData.usykFightIndex;

      // Baseline point before the first fight, so the first fight's
      // win/loss renders as a visible stroke
      points.push({
        x: (-1 - usykFightIndex + USYK_FIGHT_X) * 2,
        y: startingY,
        fight: null,
        boxer: boxerData.boxer,
        isUsykFight: false,
        cumW: 0,
        cumL: 0,
      });

      fights.forEach((fight, index) => {
        let adjustedIndex = index;

        // For this trajectory, align the specific Usyk fight with the fixed X position
        if (usykFightIndex !== -1) {
          // Align the specific Usyk fight with the fixed X position
          adjustedIndex = (index - usykFightIndex + USYK_FIGHT_X) * 2; // Double the spacing
        }

        // Update cumulative record based on actual result values BEFORE adding the point
        if (fight.result === "Win" || fight.result === "W") {
          cumulativeRecord += 1;
          cumW += 1;
        } else if (fight.result === "Loss" || fight.result === "L") {
          cumulativeRecord -= 1;
          cumL += 1;
        } else if (fight.result === "Draw" || fight.result === "D") {
          // Draw stays the same (no change to cumulativeRecord)
        }

        points.push({
          x: adjustedIndex,
          y: cumulativeRecord,
          fight: fight,
          boxer: boxerData.boxer,
          isUsykFight: index === usykFightIndex, // Mark if this is the specific Usyk fight for this trajectory
          cumW,
          cumL,
        });
      });

      return {
        boxer: boxerData.boxer,
        originalBoxer: boxerData.originalBoxer, // Keep original boxer name
        usykFightDate: boxerData.usykFightDate,
        usykFight: boxerData.usykFight,
        preW: boxerData.preW,
        preL: boxerData.preL,
        points: points,
      };
    });

    // Headline numbers for the stat tiles: each unique fighter's full
    // career, split into fights vs Usyk and fights vs everyone else,
    // so the two records are directly comparable.
    const uniqueFighters = new Set(
      this.processedData.map((d) => d.originalBoxer)
    );
    let worldW = 0;
    let worldL = 0;
    let worldD = 0;
    let usykBouts = 0;
    this.data.forEach((boxerData) => {
      if (!uniqueFighters.has(boxerData.boxer)) return;
      boxerData.fights.forEach((fight) => {
        if (fight.opponent === "Oleksandr Usyk") {
          usykBouts += 1;
          return;
        }
        if (fight.result === "Win" || fight.result === "W") worldW += 1;
        else if (fight.result === "Loss" || fight.result === "L") worldL += 1;
        else if (fight.result === "Draw" || fight.result === "D") worldD += 1;
      });
    });
    this.stats = {
      fighters: uniqueFighters.size,
      usykBouts,
      worldW,
      worldL,
      worldD,
    };
  }

  renderStats() {
    const container = document.getElementById("stats");
    if (!container || !this.stats) return;
    container.replaceChildren();

    const tiles = [
      { value: String(this.stats.fighters), label: "challengers" },
      {
        value: `${this.stats.worldW}–${this.stats.worldL}–${this.stats.worldD}`,
        label: "their combined record vs everyone else",
      },
      {
        value: `0–${this.stats.usykBouts}`,
        label: "their combined record vs Usyk",
        hero: true,
      },
    ];

    tiles.forEach((tile) => {
      const el = document.createElement("div");
      el.className = "stat-tile" + (tile.hero ? " stat-hero" : "");
      const value = document.createElement("div");
      value.className = "stat-value";
      value.textContent = tile.value;
      const label = document.createElement("div");
      label.className = "stat-label";
      label.textContent = tile.label;
      el.append(value, label);
      container.append(el);
    });
  }

  renderTable() {
    const table = document.getElementById("data-table");
    if (!table || !this.processedData) return;
    table.replaceChildren();

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["Date", "Challenger", "Walked in", "Result", "Method"].forEach((h) => {
      const th = document.createElement("th");
      th.textContent = h;
      headRow.append(th);
    });
    thead.append(headRow);

    const tbody = document.createElement("tbody");
    this.processedData.forEach((d) => {
      const tr = document.createElement("tr");
      [
        d.usykFightDate,
        d.boxer,
        `${d.preW}–${d.preL}`,
        "Loss",
        d.usykFight.method,
      ].forEach((cell) => {
        const td = document.createElement("td");
        td.textContent = cell;
        tr.append(td);
      });
      tbody.append(tr);
    });

    table.append(thead, tbody);
  }

  render() {
    this.svg.selectAll("*").remove();

    const g = this.svg
      .append("g")
      .attr("transform", `translate(${this.margin.left},${this.margin.top})`);

    // Calculate scales
    const allPoints = this.processedData.flatMap((d) => d.points);
    const xExtent = d3.extent(allPoints, (d) => d.x);
    const yExtent = d3.extent(allPoints, (d) => d.y);

    // Add some padding to y extent
    const yPadding = Math.max(1, (yExtent[1] - yExtent[0]) * 0.1);

    this.xScale = d3.scaleLinear().domain(xExtent).range([0, this.width]);

    this.yScale = d3
      .scaleLinear()
      .domain([yExtent[0] - yPadding, yExtent[1] + yPadding])
      .range([this.height, 0]);

    this.addUsykBar(g);
    this.addEraDivider(g);
    this.addTrajectories(g);

    this.hasAnimated = true;
  }

  // The gold bar: every trajectory's Usyk fight lands inside it
  addUsykBar(g) {
    const USYK_FIGHT_X = 15;
    const barLeft = this.xScale((USYK_FIGHT_X - 1) * 2);
    const barRight = this.xScale(USYK_FIGHT_X * 2);
    const barWidth = barRight - barLeft;

    g.append("rect")
      .attr("x", barLeft)
      .attr("y", 0)
      .attr("width", barWidth)
      .attr("height", this.height)
      .style("fill", INK.gold)
      .style("opacity", 0.1);

    // Hairline gold edges give the bar a defined "gate" reading
    [barLeft, barRight].forEach((x) => {
      g.append("line")
        .attr("x1", x)
        .attr("x2", x)
        .attr("y1", 0)
        .attr("y2", this.height)
        .style("stroke", INK.gold)
        .style("stroke-width", 1)
        .style("opacity", 0.35);
    });

    g.append("text")
      .attr("x", (barLeft + barRight) / 2)
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .style("fill", INK.goldBright)
      .style("font-size", "11px")
      .style("font-weight", "600")
      .style("letter-spacing", "0.08em")
      .text("THE USYK FIGHT");

    // Author attribution
    g.append("text")
      .attr("x", barRight + 10)
      .attr("y", this.height - 8)
      .style("fill", INK.muted)
      .style("font-size", "11px")
      .style("opacity", 0.6)
      .text("@velimirgasp");
  }

  // Divider between Usyk's cruiserweight and heavyweight victims
  addEraDivider(g) {
    const cutoff = new Date("2019-06-01");
    const k = this.processedData.findIndex(
      (d) => new Date(d.usykFightDate) >= cutoff
    );
    if (k <= 0) return;

    const segMidY = (d) => {
      const p = d.points.find((pt) => pt.isUsykFight);
      return this.yScale(p.y + 0.5);
    };
    const y = (segMidY(this.processedData[k - 1]) + segMidY(this.processedData[k])) / 2;

    const USYK_FIGHT_X = 15;
    const barLeft = this.xScale((USYK_FIGHT_X - 1) * 2);
    const barRight = this.xScale(USYK_FIGHT_X * 2);

    g.append("line")
      .attr("x1", barLeft - 110)
      .attr("x2", barRight + 6)
      .attr("y1", y)
      .attr("y2", y)
      .style("stroke", INK.hairline)
      .style("stroke-width", 1);

    const eraLabel = (text, dy) =>
      g
        .append("text")
        .attr("x", barLeft - 116)
        .attr("y", y + dy)
        .attr("text-anchor", "end")
        .attr("paint-order", "stroke")
        .attr("stroke", INK.surface)
        .attr("stroke-width", 3)
        .style("fill", INK.muted)
        .style("font-size", "9px")
        .style("letter-spacing", "0.12em")
        .text(text);

    eraLabel("HEAVYWEIGHT", -5);
    eraLabel("CRUISERWEIGHT", 12);
  }

  addTrajectories(g) {
    const line = d3
      .line()
      .x((d) => this.xScale(d.x))
      .y((d) => this.yScale(d.y))
      .curve(d3.curveLinear);

    const USYK_FIGHT_X = 15;
    const barRight = this.xScale(USYK_FIGHT_X * 2);
    const animate = !this.hasAnimated && !this.reducedMotion;

    // Ladder labels shrink with the available vertical gap between rungs
    const gapPx =
      (this.yScale(0) - this.yScale(this.minGap || 1)) || 14;
    const labelFontSize = Math.max(8.5, Math.min(11, gapPx - 3));

    this.processedData.forEach((boxerData, i) => {
      const points = boxerData.points;
      const usykIdx = points.findIndex((p) => p.isUsykFight);
      const prePoints = points.slice(0, usykIdx + 1);
      const postPoints = points.slice(usykIdx);
      const lossSegment = [points[usykIdx - 1], points[usykIdx]];
      const usykPoint = points[usykIdx];

      const traj = g.append("g").attr("class", "traj");

      // Career before Usyk
      const pre = traj
        .append("path")
        .datum(prePoints)
        .attr("class", "line")
        .attr("d", line)
        .style("fill", "none")
        .style("stroke", INK.primary)
        .style("stroke-width", 1.5)
        .style("opacity", PRE_OPACITY);

      // Career after Usyk — quieter: most never recover
      const post = traj
        .append("path")
        .datum(postPoints)
        .attr("class", "line")
        .attr("d", line)
        .style("fill", "none")
        .style("stroke", INK.primary)
        .style("stroke-width", 1.5)
        .style("opacity", animate ? 0 : POST_OPACITY);

      // The loss itself
      const loss = traj
        .append("path")
        .datum(lossSegment)
        .attr("d", line)
        .style("fill", "none")
        .style("stroke", INK.loss)
        .style("stroke-width", 3)
        .style("stroke-linecap", "round")
        .style("opacity", animate ? 0 : 1);

      const dot = traj
        .append("circle")
        .attr("cx", this.xScale(usykPoint.x))
        .attr("cy", this.yScale(usykPoint.y))
        .attr("r", 2.5)
        .style("fill", INK.loss)
        .style("opacity", animate ? 0 : 1);

      // Direct label: the bar doubles as a chronological ladder
      const year = new Date(boxerData.usykFightDate).getFullYear();
      const label = traj
        .append("text")
        .attr("x", barRight + 10)
        .attr("y", this.yScale(usykPoint.y + 0.5))
        .attr("dy", "0.35em")
        .attr("paint-order", "stroke")
        .attr("stroke", INK.surface)
        .attr("stroke-width", 3)
        .style("fill", INK.secondary)
        .style("font-size", `${labelFontSize}px`)
        .style("cursor", "default")
        .style("opacity", animate ? 0 : 1)
        .text(`${year} · ${boxerData.boxer}`);

      const els = { pre, post, loss, dot, label };

      // Chronological draw-in: careers appear bottom-up, in the order
      // they ran into Usyk
      if (animate) {
        const len = pre.node().getTotalLength();
        const drawDur = Math.min(1000, Math.max(300, len * 0.8));
        const delay = 200 + i * 70;
        const revealed = delay + drawDur;

        pre
          .attr("stroke-dasharray", `${len} ${len}`)
          .attr("stroke-dashoffset", len)
          .transition()
          .delay(delay)
          .duration(drawDur)
          .ease(d3.easeQuadOut)
          .attr("stroke-dashoffset", 0)
          .on("end", () => pre.attr("stroke-dasharray", null));

        loss.transition().delay(revealed).duration(260).style("opacity", 1);
        dot.transition().delay(revealed).duration(260).style("opacity", 1);
        label.transition().delay(revealed).duration(320).style("opacity", 1);
        post
          .transition()
          .delay(revealed + 120)
          .duration(420)
          .style("opacity", POST_OPACITY);
      }

      // Transparent hit path: the whole neighborhood of a line is hoverable
      const hit = traj
        .append("path")
        .datum(points)
        .attr("d", line)
        .style("fill", "none")
        .style("stroke", "rgba(0,0,0,0)")
        .style("stroke-width", 16)
        .style("pointer-events", "stroke")
        .style("cursor", "crosshair");

      const highlight = (on) => {
        pre
          .style("opacity", on ? 0.95 : PRE_OPACITY)
          .style("stroke-width", on ? 2 : 1.5);
        post
          .style("opacity", on ? 0.5 : POST_OPACITY)
          .style("stroke-width", on ? 2 : 1.5);
        loss.style("stroke-width", on ? 4 : 3);
        label
          .style("fill", on ? INK.primary : INK.secondary)
          .style("font-weight", on ? "600" : "400");
      };

      const onEnter = () => {
        highlight(true);
        mixpanel.track("Fighter Hovered", {
          fighterName: boxerData.boxer,
          timestamp: new Date().toISOString(),
        });
      };
      const onLeave = () => {
        highlight(false);
        this.hideTooltip();
      };

      hit
        .on("mouseenter", onEnter)
        .on("mouseleave", onLeave)
        .on("mousemove", (event) => {
          const [mx] = d3.pointer(event, g.node());
          const xVal = this.xScale.invert(mx);
          let nearest = points[0];
          for (const p of points) {
            if (Math.abs(p.x - xVal) < Math.abs(nearest.x - xVal)) nearest = p;
          }
          this.showTooltip(event, nearest, boxerData);
        });

      label
        .on("mouseenter", onEnter)
        .on("mouseleave", onLeave)
        .on("mousemove", (event) =>
          this.showTooltip(event, usykPoint, boxerData)
        );
    });
  }

  showTooltip(event, point, boxerData) {
    const node = this.tooltip.node();
    node.replaceChildren();

    const name = document.createElement("div");
    name.className = "tt-name";
    name.textContent = boxerData.boxer;
    node.append(name);

    const value = document.createElement("div");
    value.className = "tt-value";
    value.textContent = `${point.cumW}–${point.cumL}`;
    const valueCaption = document.createElement("span");
    valueCaption.className = "tt-caption";
    valueCaption.textContent = " career record";
    value.append(valueCaption);
    node.append(value);

    const detail = document.createElement("div");
    detail.className = "tt-detail";
    if (point.fight) {
      detail.textContent = `${point.fight.result} (${point.fight.method}) vs ${point.fight.opponent}`;
      const date = document.createElement("div");
      date.className = "tt-date";
      date.textContent = point.fight.date;
      node.append(detail, date);
    } else {
      detail.textContent = "Professional debut ahead";
      node.append(detail);
    }

    this.tooltip.style("opacity", 1);
    const ttWidth = node.offsetWidth || 180;
    const flip = event.pageX + 16 + ttWidth > window.innerWidth;
    this.tooltip
      .style("left", (flip ? event.pageX - 16 - ttWidth : event.pageX + 16) + "px")
      .style("top", event.pageY - 12 + "px");
  }

  hideTooltip() {
    this.tooltip.style("opacity", 0);
  }

  // Method to load actual CSV data
  async loadCSVData(csvFile) {
    const data = await d3.csv(csvFile);
    return this.processCSVData(data);
  }

  processCSVData(csvData) {
    // Process the actual CSV data
    // CSV format: "Opponent 1,Opponent 2,Result,Method,Date"
    const boxerMap = new Map();

    csvData.forEach((row, index) => {
      const boxer = row["Opponent 1"];
      const opponent = row["Opponent 2"];
      const result = row["Result"];
      const method = row["Method"];
      const date = row["Date"];

      // Skip invalid rows
      if (!boxer || !opponent || !result) return;

      if (!boxerMap.has(boxer)) {
        boxerMap.set(boxer, { boxer: boxer, fights: [] });
      }

      boxerMap.get(boxer).fights.push({
        opponent: opponent,
        result: result,
        method: method,
        date: date,
        fightNumber: boxerMap.get(boxer).fights.length + 1,
      });
    });

    // Sort fights by date for each boxer to ensure chronological order
    for (const [boxer, data] of boxerMap) {
      data.fights.sort((a, b) => new Date(a.date) - new Date(b.date));
      // Reassign fight numbers after sorting
      data.fights.forEach((fight, index) => {
        fight.fightNumber = index + 1;
      });
    }

    return Array.from(boxerMap.values());
  }
}

// Initialize the chart when the page loads
document.addEventListener("DOMContentLoaded", () => {
  // Track page load
  mixpanel.track("Page Loaded", {
    page: "Boxing Records Visualization",
    timestamp: new Date().toISOString(),
  });

  window.chart = new BoxingRecordsChart();
});
