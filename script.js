class BoxingRecordsChart {
    constructor() {
        this.margin = { top: 80, right: 60, bottom: 60, left: 60 };
        this.svg = d3.select("#chart");
        this.tooltip = this.createTooltip();
        this.colorScale = d3.scaleOrdinal(d3.schemeCategory10);
        
        this.init();
    }

    init() {
        window.addEventListener('resize', () => this.resize());
        this.resize();
        this.loadData();
    }

    resize() {
        const container = document.getElementById('chart-container');
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
        return d3.select("body")
            .append("div")
            .attr("class", "tooltip");
    }

    async loadData() {
        try {
            // Load actual CSV data
            this.data = await this.loadCSVData('bouts.csv');
            this.processData();
            this.render();
        } catch (error) {
            console.error("Error loading data:", error);
            // Fall back to sample data if CSV loading fails
            this.data = this.generateSampleData();
            this.processData();
            this.render();
        }
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
                    { opponent: "Tyson Fury", result: "W", fightNumber: 5 }
                ]
            },
            {
                boxer: "Anthony Joshua",
                fights: [
                    { opponent: "Fighter1", result: "W", fightNumber: 1 },
                    { opponent: "Fighter2", result: "W", fightNumber: 2 },
                    { opponent: "Oleksandr Usyk", result: "L", fightNumber: 3 },
                    { opponent: "Fighter4", result: "W", fightNumber: 4 }
                ]
            },
            {
                boxer: "Tyson Fury",
                fights: [
                    { opponent: "Fighter1", result: "W", fightNumber: 1 },
                    { opponent: "Fighter2", result: "W", fightNumber: 2 },
                    { opponent: "Fighter3", result: "D", fightNumber: 3 },
                    { opponent: "Fighter4", result: "W", fightNumber: 4 },
                    { opponent: "Oleksandr Usyk", result: "L", fightNumber: 5 }
                ]
            }
        ];
    }

    processData() {
        // Find Usyk's data
        const usykData = this.data.find(boxer => boxer.boxer === "Oleksandr Usyk");
        if (!usykData) {
            console.error("Usyk data not found!");
            return;
        }
        
        // Define a fixed X position for all Usyk fights (e.g., middle of the chart)
        const USYK_FIGHT_X = 15; // Fixed X position for alignment
        
        this.processedData = this.data.filter(boxerData => boxerData.boxer !== "Oleksandr Usyk").map(boxerData => {
            const fights = boxerData.fights;
            // Add random jitter to starting position to prevent overlap
            let cumulativeRecord = (Math.random() - 0.5) * 4; // Random jitter between -2 and +2
            const points = [];
            
            // Find when this boxer fought Usyk (if they did)
            let usykFightIndex = -1;
            if (boxerData.boxer !== "Oleksandr Usyk") {
                const usykFight = fights.find(fight => fight.opponent === "Oleksandr Usyk");
                if (usykFight) {
                    usykFightIndex = fights.findIndex(fight => fight.opponent === "Oleksandr Usyk");
                }
            }
            
            fights.forEach((fight, index) => {
                let adjustedIndex = index;
                
                // For Usyk himself, align his fights with opponents at the fixed X position
                if (boxerData.boxer === "Oleksandr Usyk") {
                    // Find if this fight is against someone in our data
                    const opponentData = this.data.find(d => d.boxer === fight.opponent);
                    if (opponentData) {
                        adjustedIndex = USYK_FIGHT_X;
                    } else {
                        // For other fights, use sequential numbering
                        adjustedIndex = index;
                    }
                } else if (usykFightIndex !== -1) {
                    // For other boxers, align their Usyk fight with the fixed X position
                    adjustedIndex = index - usykFightIndex + USYK_FIGHT_X;
                }
                
                // Update cumulative record based on actual result values BEFORE adding the point
                if (fight.result === "Win") {
                    cumulativeRecord += 1;
                } else if (fight.result === "Loss") {
                    cumulativeRecord -= 1;
                } else if (fight.result === "Draw") {
                    // Draw stays the same (no change to cumulativeRecord)
                }
                
                points.push({
                    x: adjustedIndex,
                    y: cumulativeRecord,
                    fight: fight,
                    boxer: boxerData.boxer
                });
            });
            
            return {
                boxer: boxerData.boxer,
                points: points,
                color: this.colorScale(boxerData.boxer)
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
        const allPoints = this.processedData.flatMap(d => d.points);
        const xExtent = d3.extent(allPoints, d => d.x);
        const yExtent = d3.extent(allPoints, d => d.y);
        
        // Add some padding to y extent
        const yPadding = Math.max(1, (yExtent[1] - yExtent[0]) * 0.1);
        
        this.xScale = d3.scaleLinear()
            .domain(xExtent)
            .range([0, this.width]);
        
        this.yScale = d3.scaleLinear()
            .domain([yExtent[0] - yPadding, yExtent[1] + yPadding])
            .range([this.height, 0]);

        // Add Y axis only
        this.addYAxis(g);
        
        // Add lines
        this.addLines(g);
        
        // Add Usyk fight vertical bar
        this.addUsykBar(g);
        
        // Add legend
        this.addLegend(g);
    }

    addTitle() {
        // Add main title
        this.svg.append("text")
            .attr("x", this.margin.left)
            .attr("y", 30)
            .style("font-size", "24px")
            .style("font-weight", "bold")
            .style("fill", "#ffd700")
            .text("Oleksandr Usyk Boxing Records");
            
        // Add subtitle
        this.svg.append("text")
            .attr("x", this.margin.left)
            .attr("y", 55)
            .style("font-size", "16px")
            .style("fill", "#cccccc")
            .text("Career Progression vs Opponents");
    }

    addYAxis(g) {
        // Y axis
        g.append("g")
            .attr("class", "axis")
            .call(d3.axisLeft(this.yScale));
        
        // Y axis label
        g.append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", 0 - this.margin.left)
            .attr("x", 0 - (this.height / 2))
            .attr("dy", "1em")
            .style("text-anchor", "middle")
            .style("fill", "#ffffff")
            .text("Cumulative Record (+1 Win, -1 Loss, 0 Draw)");
    }

    addGrid(g) {
        // X grid
        g.append("g")
            .attr("class", "grid")
            .attr("transform", `translate(0,${this.height})`)
            .call(d3.axisBottom(this.xScale)
                .tickSize(-this.height)
                .tickFormat("")
            );
        
        // Y grid
        g.append("g")
            .attr("class", "grid")
            .call(d3.axisLeft(this.yScale)
                .tickSize(-this.width)
                .tickFormat("")
            );
    }

    addAxes(g) {
        // X axis
        g.append("g")
            .attr("class", "axis")
            .attr("transform", `translate(0,${this.height})`)
            .call(d3.axisBottom(this.xScale).tickFormat(d3.format("d")));
        
        // Y axis
        g.append("g")
            .attr("class", "axis")
            .call(d3.axisLeft(this.yScale));
        
        // Axis labels
        g.append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", 0 - this.margin.left)
            .attr("x", 0 - (this.height / 2))
            .attr("dy", "1em")
            .style("text-anchor", "middle")
            .style("fill", "#ffffff")
            .text("Cumulative Record (+1 Win, -1 Loss, 0 Draw)");
        
        g.append("text")
            .attr("transform", `translate(${this.width / 2}, ${this.height + this.margin.bottom - 10})`)
            .style("text-anchor", "middle")
            .style("fill", "#ffffff")
            .text("Fight Number");
    }

    addLines(g) {
        const line = d3.line()
            .x(d => this.xScale(d.x))
            .y(d => this.yScale(d.y))
            .curve(d3.curveLinear);

        this.processedData.forEach(boxerData => {
            // Add main line
            g.append("path")
                .datum(boxerData.points)
                .attr("class", "line")
                .attr("d", line)
                .style("stroke", boxerData.color)
                .style("stroke-width", 2)
                .style("opacity", 0.8);
        });
    }

    addUsykBar(g) {
        // Define the fixed X position for all Usyk fights
        const USYK_FIGHT_X = 15;
        
        // Calculate the width of one segment based on the x-scale
        const segmentWidth = this.xScale(1) - this.xScale(0); // Width of one fight unit
        const barX = this.xScale(USYK_FIGHT_X) - segmentWidth;
        
        g.append("rect")
            .attr("x", barX)
            .attr("y", 0)
            .attr("width", segmentWidth)
            .attr("height", this.height)
            .style("fill", "#FFD700")
            .style("opacity", 0.3)
            .style("mix-blend-mode", "color-dodge");
    }

    addLegend(g) {
        const legend = g.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${Math.max(this.width - 150, 10)}, 20)`);

        this.processedData.forEach((boxerData, i) => {
            const legendRow = legend.append("g")
                .attr("transform", `translate(0, ${i * 20})`)
                .style("cursor", "pointer");

            legendRow.append("rect")
                .attr("width", 18)
                .attr("height", 18)
                .style("fill", boxerData.color);

            legendRow.append("text")
                .attr("x", 24)
                .attr("y", 9)
                .attr("dy", "0.35em")
                .style("fill", "#ffffff")
                .style("font-size", "12px")
                .style("opacity", 0.7)
                .text(boxerData.boxer);

            // Add hover functionality
            legendRow
                .on("mouseover", () => {
                    // Highlight the associated line
                    g.selectAll(".line")
                        .style("opacity", d => {
                            return d[0].boxer === boxerData.boxer ? 1 : 0.2;
                        })
                        .style("stroke-width", d => {
                            return d[0].boxer === boxerData.boxer ? 4 : 2;
                        });
                })
                .on("mouseout", () => {
                    // Reset all lines to normal
                    g.selectAll(".line")
                        .style("opacity", 0.8)
                        .style("stroke-width", 2);
                });
        });
    }

    showTooltip(event, d) {
        this.tooltip
            .style("opacity", 1)
            .html(`
                <strong>${d.boxer}</strong><br/>
                Fight ${d.x + 1}: vs ${d.fight.opponent}<br/>
                Result: ${d.fight.result}<br/>
                Method: ${d.fight.method}<br/>
                Date: ${d.fight.date}<br/>
                Cumulative: ${d.y > 0 ? '+' : ''}${d.y}
            `)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 10) + "px");
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
                fightNumber: boxerMap.get(boxer).fights.length + 1
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
document.addEventListener('DOMContentLoaded', () => {
    window.chart = new BoxingRecordsChart();
});