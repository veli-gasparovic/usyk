// Initialize Mixpanel
mixpanel.init("af7a3b5acec336f429aba394a5ad602c");

class BoxingRecordsChart {
  constructor() {
    this.margin = { top: 80, right: 200, bottom: 60, left: 30 };
    this.svg = d3.select("#chart");
    this.tooltip = this.createTooltip();
    this.colorScale = d3.scaleOrdinal(d3.schemeCategory10);
    this.verticalOrder = false; // Set to true for date-based vertical ordering, false for equal spacing
    this.showLegend = false; // Variable to control legend visibility

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
    this.data = await this.loadCSVData("budbouts.csv");
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
    // Find Crawford's data instead of Usyk's
    const crawfordData = this.data.find(
      (boxer) => boxer.boxer === "Terence Crawford"
    );
    if (!crawfordData) {
      console.error("Crawford data not found!");
      return;
    }

    // Define a fixed X position for all Crawford fights (e.g., middle of the chart)
    const CRAWFORD_FIGHT_X = 15; // Fixed X position for alignment

    // Filter out Crawford and calculate where each fighter's Crawford fight would be
    const fightersWithCrawford = this.data.filter(
      (boxerData) =>
        boxerData.boxer !== "Terence Crawford" &&
        boxerData.fights.some((fight) => fight.opponent === "Terence Crawford")
    );

    // Create color mapping for opponents - ensure same color for same opponent
    this.opponentColorMap = new Map();
    fightersWithCrawford.forEach((boxerData) => {
      if (!this.opponentColorMap.has(boxerData.boxer)) {
        this.opponentColorMap.set(boxerData.boxer, this.colorScale(boxerData.boxer));
      }
    });

    // First pass: calculate each fighter's record at EACH Crawford fight (create multiple trajectories)
    const fightersWithCrawfordPositions = [];
    
    fightersWithCrawford.forEach((boxerData) => {
      const fights = boxerData.fights;
      
      // Find ALL Crawford fights for this boxer
      fights.forEach((fight, index) => {
        if (fight.opponent === "Terence Crawford") {
          // Calculate cumulative record up to (but not including) this specific Crawford fight
          let recordAtCrawford = 0;
          for (let i = 0; i < index; i++) {
            const prevFight = fights[i];
            if (prevFight.result === "Win" || prevFight.result === "W") recordAtCrawford += 1;
            else if (prevFight.result === "Loss" || prevFight.result === "L") recordAtCrawford -= 1;
          }

          // Count how many Crawford fights this boxer has had
          const totalCrawfordFights = fights.filter(f => f.opponent === "Terence Crawford").length;
          const crawfordFightNumber = fights.slice(0, index + 1).filter(f => f.opponent === "Terence Crawford").length;
          
          fightersWithCrawfordPositions.push({
            ...boxerData,
            crawfordFightIndex: index,
            recordAtCrawford,
            originalBoxer: boxerData.boxer, // Store original name for color mapping
            boxer: totalCrawfordFights > 1 ? `${boxerData.boxer} (${crawfordFightNumber})` : boxerData.boxer,
            crawfordFightDate: fight.date, // Store the date of this specific Crawford fight for sorting
          });
        }
      });
    });

    // Sort all trajectories by the date of their respective Crawford fight (most recent first)
    fightersWithCrawfordPositions.sort((a, b) => new Date(b.crawfordFightDate) - new Date(a.crawfordFightDate));

    // Configure positioning so Crawford fight segments form a vertical line
    // All Crawford fights will be at the same X position for vertical alignment
    let crawfordCumulativeWins = 0; // Crawford's cumulative wins counter
    const startingX = 5; // Start the Crawford line from the left
    const fightSpacing = 3.0; // Spacing between individual fights (50% wider)
    
    this.processedData = fightersWithCrawfordPositions.map((boxerData, index) => {
      const fights = boxerData.fights;
      
      // Position this Crawford fight at the same X location for vertical alignment
      const crawfordFightX = startingX; // All Crawford fights at same X position
      const totalFighters = fightersWithCrawfordPositions.length;
      const crawfordFightY = (totalFighters - 1 - crawfordCumulativeWins); // Reverse order - latest at top
      crawfordCumulativeWins += 1; // Crawford wins, so his line goes up for the next fight
      
      // Show the entire career record for each fighter
      const startIndex = 0; // Start from the beginning of their career
      const endIndex = fights.length; // Show all fights to the end of their career
      const points = [];

      // Use the specific Crawford fight index for this trajectory
      const crawfordFightIndex = boxerData.crawfordFightIndex;
      
      // Calculate the record at the Crawford fight to position it correctly
      const recordAtCrawfordFight = boxerData.recordAtCrawford;
      const startingY = crawfordFightY - recordAtCrawfordFight;
      
      // For fighters whose first fight was with Crawford, we need to handle the starting point differently
      if (crawfordFightIndex === 0) {
        // Add a starting point before the Crawford fight
        const startingAdjustedIndex = (crawfordFightX - 1) * 2; // Double the spacing to match script.js
        points.push({
          x: startingAdjustedIndex,
          y: startingY,
          fight: null,
          boxer: boxerData.boxer,
          isCrawfordFight: false,
        });
      }
      
      for (let fightIndex = startIndex; fightIndex < endIndex; fightIndex++) {
        const fight = fights[fightIndex];
        // Calculate X position relative to the Crawford fight position
        const relativeIndex = fightIndex - crawfordFightIndex;
        const adjustedIndex = (crawfordFightX + relativeIndex) * 2; // Double the spacing to match script.js
        
        // Calculate cumulative record up to this fight
        let cumulativeRecord = 0;
        for (let i = 0; i <= fightIndex; i++) {
          const prevFight = fights[i];
          if (prevFight.result === "Win" || prevFight.result === "W") {
            cumulativeRecord += 1;
          } else if (prevFight.result === "Loss" || prevFight.result === "L") {
            cumulativeRecord -= 1;
          }
        }
        
        // Adjust Y position so the Crawford fight lands at the target position
        const yOffset = startingY;
        const adjustedY = cumulativeRecord + yOffset;

        points.push({
          x: adjustedIndex,
          y: adjustedY,
          fight: fight,
          boxer: boxerData.boxer,
          isCrawfordFight: fightIndex === crawfordFightIndex, // Mark if this is the specific Crawford fight for this trajectory
        });
      }

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

    // Add Crawford bar
    this.addCrawfordBar(g);

    // Add legend only if showLegend is true
    if (this.showLegend) {
      this.addLegend(g);
    }
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
      .text("Crawford's Career Timeline");

    // Add subtitle
    this.svg
      .append("text")
      .attr("x", this.margin.left)
      .attr("y", 75)
      .style("font-size", "16px")
      .style("fill", "#cccccc")
      .text(
        "Each opponent's line represents their cumulative record, win = +1, loss = -1, draw = 0"
      );

    // Add subtitle
    this.svg
      .append("text")
      .attr("x", this.margin.left)
      .attr("y", 95)
      .style("font-size", "16px")
      .style("fill", "#cccccc")
      .text("The vertical bar highlights their fight with Crawford. All lost.");


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

      // Add colored segment for Crawford fight  
      // Find the point that is marked as the Crawford fight for this specific trajectory
      const crawfordFightIndex = boxerData.points.findIndex(
        (point) => point.isCrawfordFight === true
      );
      if (crawfordFightIndex !== -1) {
        // Always highlight the segment TO the Crawford fight point (showing the loss)
        if (crawfordFightIndex > 0) {
          const crawfordSegment = [
            boxerData.points[crawfordFightIndex - 1],
            boxerData.points[crawfordFightIndex],
          ];

          g.append("path")
            .datum(crawfordSegment)
            .attr("class", "crawford-fight-segment")
            .attr("d", line)
            .style("stroke", boxerData.color)
            .style("stroke-width", 4)
            .style("opacity", 1)
            .on("mouseover", (event) => {
              const fight = boxerData.points[crawfordFightIndex].fight;
              
              // Calculate total record from points array
              let totalWins = 0, totalLosses = 0, totalDraws = 0;
              boxerData.points.forEach(point => {
                if (point.fight) {
                  if (point.fight.result === "Win" || point.fight.result === "W") totalWins++;
                  else if (point.fight.result === "Loss" || point.fight.result === "L") totalLosses++;
                  else if (point.fight.result === "Draw" || point.fight.result === "D") totalDraws++;
                }
              });
              
              this.tooltip
                .style("opacity", 1)
                .html(`${boxerData.originalBoxer} (${totalWins}-${totalLosses}-${totalDraws}), ${fight.date}`)
                .style("left", event.pageX + 10 + "px")
                .style("top", event.pageY - 35 + "px");
              
              // Highlight the associated line
              g.selectAll(".line")
                .filter((d) => d[0].boxer === boxerData.boxer)
                .style("opacity", 1)
                .style("stroke-width", 3);
            })
            .on("mouseout", () => {
              this.tooltip.style("opacity", 0);
              
              // Reset the associated line
              g.selectAll(".line")
                .filter((d) => d[0].boxer === boxerData.boxer)
                .style("opacity", boxerData.originalOpacity)
                .style("stroke-width", 2);
            });
        } else if (crawfordFightIndex === 0 && boxerData.points.length > 1) {
          // If Crawford fight is the first fight, highlight the segment from it to the next
          const crawfordSegment = [boxerData.points[0], boxerData.points[1]];

          g.append("path")
            .datum(crawfordSegment)
            .attr("class", "crawford-fight-segment")
            .attr("d", line)
            .style("stroke", boxerData.color)
            .style("stroke-width", 3)
            .style("opacity", 1)
            .on("mouseover", (event) => {
              const fight = boxerData.points[0].fight;
              
              // Calculate total record from points array
              let totalWins = 0, totalLosses = 0, totalDraws = 0;
              boxerData.points.forEach(point => {
                if (point.fight) {
                  if (point.fight.result === "Win" || point.fight.result === "W") totalWins++;
                  else if (point.fight.result === "Loss" || point.fight.result === "L") totalLosses++;
                  else if (point.fight.result === "Draw" || point.fight.result === "D") totalDraws++;
                }
              });
              
              this.tooltip
                .style("opacity", 1)
                .html(`${boxerData.originalBoxer} (${totalWins}-${totalLosses}-${totalDraws}), ${fight.date}`)
                .style("left", event.pageX + 10 + "px")
                .style("top", event.pageY - 35 + "px");
              
              // Highlight the associated line
              g.selectAll(".line")
                .filter((d) => d[0].boxer === boxerData.boxer)
                .style("opacity", 1)
                .style("stroke-width", 3);
            })
            .on("mouseout", () => {
              this.tooltip.style("opacity", 0);
              
              // Reset the associated line
              g.selectAll(".line")
                .filter((d) => d[0].boxer === boxerData.boxer)
                .style("opacity", boxerData.originalOpacity)
                .style("stroke-width", 2);
            });
        }
      }
    });
  }

  addCrawfordBar(g) {
    // Define the fixed X position for all Crawford fights (doubled to match the new spacing)
    const CRAWFORD_FIGHT_X = 5;

    // Calculate the width of one segment based on the x-scale and double it
    const segmentWidth = (this.xScale(1) - this.xScale(0)) * 2; // Double the width of one fight unit
    const barX = this.xScale(CRAWFORD_FIGHT_X * 2) - segmentWidth;
    const barCenterX = barX + segmentWidth / 2;

    g.append("rect")
      .attr("x", barX)
      .attr("y", 0)
      .attr("width", segmentWidth)
      .attr("height", this.height)
      .style("fill", "white")
      .style("opacity", 0.2)
      .style("mix-blend-mode", "color-dodge")
      .style("pointer-events", "none");

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
      .text("Crawford");

    g.append("text")
      .attr("x", textX)
      .attr("y", 30) // Second line below first
      .attr("text-anchor", "start")
      .style("fill", "#ffffff")
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .style("opacity", 0.7)
      .text("Fight");

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
        `translate(${this.width + 10}, 20)`
      );

    this.processedData.forEach((boxerData, i) => {
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