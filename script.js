// Initialize Mixpanel
mixpanel.init("af7a3b5acec336f429aba394a5ad602c");

class BoxingRecordsChart {
  constructor() {
    this.margin = { top: 80, right: 10, bottom: 60, left: 30 };
    this.svg = d3.select("#chart");
    this.tooltip = this.createTooltip();
    this.colorScale = d3.scaleOrdinal(d3.schemeCategory10);
    this.verticalOrder = false; // Set to true for date-based vertical ordering, false for equal spacing

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
    this.render();

    // Track successful data load
    mixpanel.track("Data Loaded Successfully", {
      dataSource: "CSV",
      fightersCount: this.data.length,
    });
  }

  generateSampleData() {
    // Sample data structure - will be replaced by CSV data
    return [
      {
        boxer: "Oleksandr Usyk",
        fights: [
          { opponent: "Opponent1", result: "W", fightNumber: 1 },
          { opponent: "Opponent2", result: "W", fightNumber: 2 },
          { opponent: "Opponent3", result: "W", fightNumber: 3 },
          { opponent: "Anthony Joshua", result: "W", fightNumber: 4 },
          { opponent: "Anthony Joshua", result: "W", fightNumber: 5 },
          { opponent: "Tyson Fury", result: "W", fightNumber: 6 },
        ],
      },
      {
        boxer: "Anthony Joshua",
        fights: [
          { opponent: "Fighter1", result: "W", fightNumber: 1 },
          { opponent: "Fighter2", result: "W", fightNumber: 2 },
          { opponent: "Fighter3", result: "W", fightNumber: 3 },
          { opponent: "Oleksandr Usyk", result: "L", fightNumber: 4 },
          { opponent: "Fighter5", result: "W", fightNumber: 5 },
          { opponent: "Fighter6", result: "W", fightNumber: 6 },
          { opponent: "Oleksandr Usyk", result: "L", fightNumber: 7 },
          { opponent: "Fighter8", result: "W", fightNumber: 8 },
        ],
      },
      {
        boxer: "Tyson Fury",
        fights: [
          { opponent: "Fighter1", result: "W", fightNumber: 1 },
          { opponent: "Fighter2", result: "W", fightNumber: 2 },
          { opponent: "Fighter3", result: "D", fightNumber: 3 },
          { opponent: "Fighter4", result: "W", fightNumber: 4 },
          { opponent: "Oleksandr Usyk", result: "L", fightNumber: 5 },
        ],
      },
    ];
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

    // Create color mapping for opponents - ensure same color for same opponent
    this.opponentColorMap = new Map();
    fightersWithUsyk.forEach((boxerData) => {
      if (!this.opponentColorMap.has(boxerData.boxer)) {
        this.opponentColorMap.set(boxerData.boxer, this.colorScale(boxerData.boxer));
      }
    });

    // First pass: calculate each fighter's record at EACH Usyk fight (create multiple trajectories)
    const fightersWithUsykPositions = [];
    
    fightersWithUsyk.forEach((boxerData) => {
      const fights = boxerData.fights;
      
      // Find ALL Usyk fights for this boxer
      fights.forEach((fight, index) => {
        if (fight.opponent === "Oleksandr Usyk") {
          // Calculate cumulative record up to (but not including) this specific Usyk fight
          let recordAtUsyk = 0;
          for (let i = 0; i < index; i++) {
            const prevFight = fights[i];
            if (prevFight.result === "Win" || prevFight.result === "W") recordAtUsyk += 1;
            else if (prevFight.result === "Loss" || prevFight.result === "L") recordAtUsyk -= 1;
          }

          // Count how many Usyk fights this boxer has had
          const totalUsykFights = fights.filter(f => f.opponent === "Oleksandr Usyk").length;
          const usykFightNumber = fights.slice(0, index + 1).filter(f => f.opponent === "Oleksandr Usyk").length;
          
          fightersWithUsykPositions.push({
            ...boxerData,
            usykFightIndex: index,
            recordAtUsyk,
            originalBoxer: boxerData.boxer, // Store original name for color mapping
            boxer: totalUsykFights > 1 ? `${boxerData.boxer} (${usykFightNumber})` : boxerData.boxer,
            usykFightDate: fight.date, // Store the date of this specific Usyk fight for sorting
          });
        }
      });
    });

    // Sort all trajectories by the date of their respective Usyk fight
    fightersWithUsykPositions.sort((a, b) => new Date(a.usykFightDate) - new Date(b.usykFightDate));

    // Configure vertical positioning for the Usyk segments
    let targetUsykYFunction;
    
    if (this.verticalOrder) {
      // Date-based Y positioning
      const allUsykDates = fightersWithUsykPositions.map(d => new Date(d.usykFightDate));
      const dateExtent = d3.extent(allUsykDates);
      const dateYScale = d3.scaleTime()
        .domain(dateExtent)
        .range([-20, 20]);
      targetUsykYFunction = (boxerData) => dateYScale(new Date(boxerData.usykFightDate));
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
      const points = [];

      // Use the specific Usyk fight index for this trajectory
      const usykFightIndex = boxerData.usykFightIndex;

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
        } else if (fight.result === "Loss" || fight.result === "L") {
          cumulativeRecord -= 1;
        } else if (fight.result === "Draw" || fight.result === "D") {
          // Draw stays the same (no change to cumulativeRecord)
        }

        points.push({
          x: adjustedIndex,
          y: cumulativeRecord,
          fight: fight,
          boxer: boxerData.boxer,
          isUsykFight: index === usykFightIndex, // Mark if this is the specific Usyk fight for this trajectory
        });
      });

      return {
        boxer: boxerData.boxer,
        originalBoxer: boxerData.originalBoxer, // Keep original boxer name 
        points: points,
        color: this.opponentColorMap.get(boxerData.originalBoxer), // Use color based on original name
      };
    });
  }

  render() {
    this.svg.selectAll("*").remove();

    // Add title
    this.addTitle();

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

    // Add Y axis only
    // this.addYAxis(g);

    // Add lines
    this.addLines(g);

    // Add Usyk fight vertical bar
    this.addUsykBar(g);

    // Add legend
    this.addLegend(g);
  }

  addTitle() {
    // Add main title
    this.svg
      .append("text")
      .attr("x", this.margin.left)
      .attr("y", 50)
      .style("font-size", "24px")
      .style("font-weight", "bold")
      .style("fill", "#ffd700")
      .text("Facing the Usyk Filter");

    // Add subtitle
    this.svg
      .append("text")
      .attr("x", this.margin.left)
      .attr("y", 75)
      .style("font-size", "16px")
      .style("fill", "#cccccc")
      .text(
        "Each line represents a fighter's cumulative record, win = +1, loss = -1, draw = 0"
      );

    // Add subtitle
    this.svg
      .append("text")
      .attr("x", this.margin.left)
      .attr("y", 95)
      .style("font-size", "16px")
      .style("fill", "#cccccc")
      .text("The vertical bar represents their first fight with Usyk");


  }

  addYAxis(g) {
    // Y axis with tick numbers but no label
    g.append("g").attr("class", "axis").call(d3.axisLeft(this.yScale));
  }

  addGrid(g) {
    // X grid
    g.append("g")
      .attr("class", "grid")
      .attr("transform", `translate(0,${this.height})`)
      .call(d3.axisBottom(this.xScale).tickSize(-this.height).tickFormat(""));

    // Y grid
    g.append("g")
      .attr("class", "grid")
      .call(d3.axisLeft(this.yScale).tickSize(-this.width).tickFormat(""));
  }

  addAxes(g) {
    // X axis
    g.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${this.height})`)
      .call(d3.axisBottom(this.xScale).tickFormat(d3.format("d")));

    // Y axis
    g.append("g").attr("class", "axis").call(d3.axisLeft(this.yScale));

    // Axis labels
    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - this.margin.left)
      .attr("x", 0 - this.height / 2)
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .style("fill", "#ffffff")
      .text("Cumulative Record (+1 Win, -1 Loss, 0 Draw)");

    g.append("text")
      .attr(
        "transform",
        `translate(${this.width / 2}, ${this.height + this.margin.bottom - 10})`
      )
      .style("text-anchor", "middle")
      .style("fill", "#ffffff")
      .text("Fight Number");
  }

  addLines(g) {
    const line = d3
      .line()
      .x((d) => this.xScale(d.x))
      .y((d) => this.yScale(d.y))
      .curve(d3.curveLinear);

    this.processedData.forEach((boxerData) => {
      // Add main line with random opacity
      const randomOpacity = 0.05 + Math.random() * 0.15; // Random between 0.05 and 0.4
      boxerData.originalOpacity = randomOpacity; // Store original opacity for hover reset
      g.append("path")
        .datum(boxerData.points)
        .attr("class", "line")
        .attr("d", line)
        .style("stroke", "white")
        .style("stroke-width", 2)
        .style("opacity", randomOpacity)        

      // Add colored segment for Usyk fight  
      // Find the point that is marked as the Usyk fight for this specific trajectory
      const usykFightIndex = boxerData.points.findIndex(
        (point) => point.isUsykFight === true
      );
      if (usykFightIndex !== -1) {
        // Always highlight the segment TO the Usyk fight point (showing the loss)
        if (usykFightIndex > 0) {
          const usykSegment = [
            boxerData.points[usykFightIndex - 1],
            boxerData.points[usykFightIndex],
          ];

          g.append("path")
            .datum(usykSegment)
            .attr("class", "usyk-fight-segment")
            .attr("d", line)
            .style("stroke", boxerData.color)
            .style("stroke-width", 4)
            .style("opacity", 1);
        } else if (usykFightIndex === 0 && boxerData.points.length > 1) {
          // If Usyk fight is the first fight, highlight the segment from it to the next
          const usykSegment = [boxerData.points[0], boxerData.points[1]];

          g.append("path")
            .datum(usykSegment)
            .attr("class", "usyk-fight-segment")
            .attr("d", line)
            .style("stroke", boxerData.color)
            .style("stroke-width", 3)
            .style("opacity", 1);
        }
      }
    });
  }

  addUsykBar(g) {
    // Define the fixed X position for all Usyk fights (doubled to match the new spacing)
    const USYK_FIGHT_X = 15;

    // Calculate the width of one segment based on the x-scale and double it
    const segmentWidth = (this.xScale(1) - this.xScale(0)) * 2; // Double the width of one fight unit
    const barX = this.xScale(USYK_FIGHT_X * 2) - segmentWidth;
    const barCenterX = barX + segmentWidth / 2;

    g.append("rect")
      .attr("x", barX)
      .attr("y", 0)
      .attr("width", segmentWidth)
      .attr("height", this.height)
      // .style("fill", "#FFD700")
      .style("fill", "white")
      .style("opacity", 0.2)
      .style("mix-blend-mode", "color-dodge");

    // Add text label to the right of the bar
    const textX = barX + segmentWidth + 10; // 10px to the right of the bar

    g.append("text")
      .attr("x", textX)
      .attr("y", 15) // First line at top level
      .attr("text-anchor", "start")
      .style("fill", "#ffffff")
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .style("opacity", 0.7)
      .text("Usyk");

    g.append("text")
      .attr("x", textX)
      .attr("y", 30) // Second line below first
      .attr("text-anchor", "start")
      .style("fill", "#ffffff")
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .style("opacity", 0.7)
      .text("Filter");

    // Add author attribution at bottom of bar
    g.append("text")
      .attr("x", textX)
      .attr("y", this.height - 25) // First line at bottom
      .attr("text-anchor", "start")
      .style("fill", "#ffffff")
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .style("opacity", 0.2)
      .text("Author:");

    g.append("text")
      .attr("x", textX)
      .attr("y", this.height - 10) // Second line below first
      .attr("text-anchor", "start")
      .style("fill", "#ffffff")
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .style("opacity", 0.2)
      .text("@velimirgasp");
  }

  addLegend(g) {
    const legend = g
      .append("g")
      .attr("class", "legend")
      .attr(
        "transform",
        `translate(${Math.max(this.width - 150, 10)}, 20)`
      );

    this.processedData.slice().reverse().forEach((boxerData, i) => {
      const legendRow = legend
        .append("g")
        .attr("transform", `translate(0, ${i * 24})`)
        .style("cursor", "pointer");

      legendRow
        .append("line")
        .attr("x1", 0)
        .attr("y1", 3)
        .attr("x2", 18)
        .attr("y2", 15)
        .style("stroke", boxerData.color)
        .style("stroke-width", 4)
        .style("opacity", 1);

      legendRow
        .append("text")
        .attr("x", 22)
        .attr("y", 9)
        .attr("dy", "0.35em")
        .style("fill", "#ffffff")
        .style("font-size", "12px")
        .style("opacity", 0.7)
        .text(boxerData.boxer);

      // Add hover functionality
      legendRow
        .on("mouseover", () => {
          console.log("Fighter Hovered", boxerData.boxer);
          // Track fighter hover
          mixpanel.track("Fighter Hovered", {
            fighterName: boxerData.boxer,
            timestamp: new Date().toISOString(),
          });

          // Highlight only the associated line
          g.selectAll(".line")
            .filter((d) => d[0].boxer === boxerData.boxer)
            .style("opacity", 1)
            .style("stroke-width", 2);

          // Underline the fighter name
          legendRow.select("text").style("text-decoration", "underline");
        })
        .on("mouseout", () => {
          // Reset only the associated line
          g.selectAll(".line")
            .filter((d) => d[0].boxer === boxerData.boxer)
            .style("opacity", boxerData.originalOpacity)
            .style("stroke-width", 2);

          // Remove underline from fighter name
          legendRow.select("text").style("text-decoration", "none");
        });
    });
  }

  showTooltip(event, d) {
    this.tooltip
      .style("opacity", 1)
      .html(
        `
                <strong>${d.boxer}</strong><br/>
                Fight ${d.x + 1}: vs ${d.fight.opponent}<br/>
                Result: ${d.fight.result}<br/>
                Method: ${d.fight.method}<br/>
                Date: ${d.fight.date}<br/>
                Cumulative: ${d.y > 0 ? "+" : ""}${d.y}
            `
      )
      .style("left", event.pageX + 10 + "px")
      .style("top", event.pageY - 10 + "px");
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
