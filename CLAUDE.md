# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a boxing records visualization application focused on Oleksandr Usyk's career progression. The application creates an interactive D3.js-based line chart showing how boxers' cumulative records (wins/losses) progress over time, with special focus on when they fought Usyk.

## Architecture

- **Frontend-only application** - No backend, build tools, or package managers
- **Technology stack**: Vanilla JavaScript, D3.js (v7), HTML5, CSS3
- **Data source**: CSV file (`bouts.csv`) containing boxing match records
- **Visualization**: Interactive line chart with tooltips showing fight details

## Key Files

- `index.html` - Main HTML structure, loads D3.js from CDN
- `script.js` - Main visualization logic in `BoxingRecordsChart` class
- `styles.css` - Dark theme styling for the visualization
- `bouts.csv` - Boxing match data in CSV format

## Code Structure

### BoxingRecordsChart Class (`script.js`)

The main visualization class handles:
- **Data loading**: Currently uses sample data, has `loadCSVData()` method for real CSV
- **Data processing**: Aligns fight timelines so Usyk fights appear at same x-position
- **Rendering**: Creates D3.js line chart with grid, axes, legend, and interactive tooltips
- **Responsive design**: Handles window resize events

### Data Format

CSV structure: `Opponent 1,Opponent 2,Result,Method,Date`
- Data shows bilateral fight records (A vs B, B vs A)
- Results are from first opponent's perspective
- Includes fight methods (KO, TKO, Decision, etc.) and dates

## Development Commands

**No build system** - Open `index.html` directly in browser for development.

**Testing**: Manual testing only - no automated test framework.

**Data updates**: Modify `bouts.csv` file and call `loadCSV('bouts.csv')` function.

## Key Features

1. **Timeline alignment**: Fights against Usyk appear at same x-coordinate across all boxers
2. **Interactive tooltips**: Show fight details on hover
3. **Responsive design**: Adapts to window size changes
4. **Dark theme**: Boxing-appropriate visual styling
5. **Cumulative scoring**: +1 for wins, -1 for losses, 0 for draws

## Data Processing Logic

The application processes CSV data to:
1. Group fights by boxer
2. Calculate cumulative win/loss records
3. Align timelines so Usyk fights appear at corresponding positions
4. Generate color-coded lines for each boxer (Usyk highlighted)

## Future Enhancements

- CSV loading is implemented but not currently used (uses sample data)
- Function `loadCSV(filename)` available to switch to real data
- Chart supports adding more boxers beyond current sample set