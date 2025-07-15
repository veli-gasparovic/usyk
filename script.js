class BoxingRecordsChart {
    constructor() {
        this.margin = { top: 40, right: 60, bottom: 60, left: 60 };
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
            // For now, create sample data. Replace with actual CSV loading later
            this.data = this.generateSampleData();
            this.processData();
            this.render();
        } catch (error) {
            console.error("Error loading data:", error);
            // Show error message or create sample data
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
        
        this.processedData = this.data.map(boxerData => {
            const fights = boxerData.fights;
            let cumulativeRecord = 0;
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
                // Adjust starting point so Usyk fights align
                let adjustedIndex = index;
                if (boxerData.boxer !== "Oleksandr Usyk" && usykFightIndex !== -1) {
                    // Align this boxer's Usyk fight with Usyk's corresponding fight
                    const usykFightWithThisBoxer = usykData.fights.find(f => f.opponent === boxerData.boxer);
                    if (usykFightWithThisBoxer) {
                        const usykFightPosition = usykData.fights.findIndex(f => f.opponent === boxerData.boxer);
                        adjustedIndex = index - usykFightIndex + usykFightPosition;
                    }
                }
                
                points.push({
                    x: adjustedIndex,
                    y: cumulativeRecord,
                    fight: fight,
                    boxer: boxerData.boxer
                });
                
                // Update cumulative record
                if (fight.result === "W") {
                    cumulativeRecord += 1;
                } else if (fight.result === "L") {
                    cumulativeRecord -= 1;
                }
                // Draw stays the same (no change to cumulativeRecord)
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

        // Add grid
        this.addGrid(g);
        
        // Add axes
        this.addAxes(g);
        
        // Add lines
        this.addLines(g);
        
        // Add legend
        this.addLegend(g);
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
            .curve(d3.curveStepAfter);

        this.processedData.forEach(boxerData => {
            // Add line
            g.append("path")
                .datum(boxerData.points)
                .attr("class", "line")
                .attr("d", line)
                .style("stroke", boxerData.color)
                .style("stroke-width", boxerData.boxer === "Oleksandr Usyk" ? 3 : 2)
                .style("opacity", boxerData.boxer === "Oleksandr Usyk" ? 1 : 0.8);

            // Add points
            g.selectAll(`.point-${boxerData.boxer.replace(/\s+/g, '')}`)
                .data(boxerData.points)
                .enter()
                .append("circle")
                .attr("class", `point-${boxerData.boxer.replace(/\s+/g, '')}`)
                .attr("cx", d => this.xScale(d.x))
                .attr("cy", d => this.yScale(d.y))
                .attr("r", 4)
                .style("fill", boxerData.color)
                .style("stroke", "#ffffff")
                .style("stroke-width", 1)
                .on("mouseover", (event, d) => this.showTooltip(event, d))
                .on("mouseout", () => this.hideTooltip());
        });
    }

    addLegend(g) {
        const legend = g.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${this.width - 150}, 20)`);

        this.processedData.forEach((boxerData, i) => {
            const legendRow = legend.append("g")
                .attr("transform", `translate(0, ${i * 20})`);

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
                .text(boxerData.boxer);
        });
    }

    showTooltip(event, d) {
        this.tooltip
            .style("opacity", 1)
            .html(`
                <strong>${d.boxer}</strong><br/>
                Fight ${d.x + 1}: vs ${d.fight.opponent}<br/>
                Result: ${d.fight.result}<br/>
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
        try {
            const data = await d3.csv(csvFile);
            // Process CSV data into the expected format
            this.data = this.processCSVData(data);
            this.processData();
            this.render();
        } catch (error) {
            console.error("Error loading CSV:", error);
        }
    }

    processCSVData(csvData) {
        // This method will process the actual CSV data
        // Expected CSV format: boxer, opponent, result, fight_number
        const boxerMap = new Map();
        
        csvData.forEach(row => {
            const boxer = row.boxer;
            if (!boxerMap.has(boxer)) {
                boxerMap.set(boxer, { boxer: boxer, fights: [] });
            }
            
            boxerMap.get(boxer).fights.push({
                opponent: row.opponent,
                result: row.result,
                fightNumber: +row.fight_number
            });
        });
        
        return Array.from(boxerMap.values());
    }
}

// Initialize the chart when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.chart = new BoxingRecordsChart();
});

// Function to load CSV data (call this when you have the CSV file)
function loadCSV(filename) {
    if (window.chart) {
        window.chart.loadCSVData(filename);
    }
}