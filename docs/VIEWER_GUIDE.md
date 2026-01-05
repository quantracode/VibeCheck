# VibeCheck Viewer Guide

The VibeCheck web viewer provides interactive visualizations for analyzing scan results. This guide covers the main visualization modes and features.

## Getting Started

### Launching the Viewer

```bash
# Run a scan and open results in browser
vibecheck scan --open

# Or view an existing artifact
vibecheck view scan.json
```

The viewer runs locally at `http://localhost:3000` - no data is sent to external servers.

### Loading Artifacts

1. **Drag and drop**: Drop a scan artifact JSON file onto the viewer
2. **File picker**: Click "Upload Artifact" and select a file
3. **CLI**: Use `vibecheck view <artifact.json>`

---

## Dashboard Overview

The main dashboard shows:

- **Security Score**: Overall score from 0-100
- **Finding Summary**: Counts by severity (Critical, High, Medium, Low)
- **Quick Stats**: Total routes, auth coverage %, findings per route
- **Recent Findings**: Latest findings with quick actions

---

## Architecture Graph

The architecture graph provides a visual representation of your application's security topology.

### Node Types

| Icon | Type | Description |
|------|------|-------------|
| M | Route | API endpoints (GET/POST/PUT/DELETE handlers) |
| F | File | Source files with findings |
| MW | Middleware | Middleware components (auth, rate limiting) |
| DB | Database | Database connection points |
| EX | External | External API calls |
| C | Config | Configuration files |

### Risk Indicators

Nodes display risk levels through color-coded rings:

| Color | Risk Level |
|-------|------------|
| Green | None - no findings |
| Blue | Low risk |
| Yellow | Medium risk |
| Orange | High risk |
| Red | Critical risk |

### Controls

- **Zoom**: Mouse wheel or +/- buttons
- **Pan**: Click and drag the canvas
- **Reset**: Click the maximize button to reset view
- **Select**: Click a node to view its findings

### Node Tooltips

Hover over any node to see:
- File location
- Number of findings
- Risk level
- Protection status (Auth, Middleware, Validated, Rate Limited)

### Edges

Edges show relationships between nodes:
- Highlighted edges indicate correlation between findings
- Arrow direction shows data/control flow

---

## Route Heatmap

The heatmap provides a tabular view of protection coverage across all routes.

### Protection Columns

| Column | What It Checks |
|--------|----------------|
| Auth | Authentication check present |
| Validation | Input validation (Zod, Yup, etc.) |
| Rate Limit | Rate limiting configured |
| Middleware | Covered by middleware matcher |
| Timeout | Request timeout configured |

### Status Icons

| Icon | Status | Meaning |
|------|--------|---------|
| Shield | Protected | Control is present and verified |
| Shield Off | Missing | Control is missing or not detected |
| Question | Unknown | Unable to determine status |

### Reading the Heatmap

1. **Rows**: Each row represents an API route
2. **Columns**: Each column represents a protection type
3. **Cells**: Status of that protection for that route
4. **Findings**: Link to related findings

### Route Colors

- **Red background**: Route has security gaps
- **Bold text**: State-changing methods (POST, PUT, PATCH, DELETE)

### Expanding Routes

Click the chevron on any route to expand details:
- Full file path and line number
- Detailed status for each protection
- Links to related findings
- Tooltips with evidence

### Summary Bar

The top of the heatmap shows aggregate coverage:
- Percentage protected for each column
- Visual bar showing protected vs. gaps

---

## What-If Mode

What-If mode lets you simulate changes to understand their impact on your security posture without modifying any files.

### Enabling What-If Mode

Toggle the "What-If Mode" switch in the viewer header.

### Available Actions

For each finding, you can simulate:

| Action | Effect |
|--------|--------|
| **Ignore** | Simulate ignoring this finding entirely |
| **Downgrade** | Simulate reducing severity (e.g., High → Medium) |
| **Waive** | Simulate waiving with a reason |

### Path Ignores

Simulate ignoring all findings matching a path pattern:

1. Click "Add Path Ignore"
2. Enter a glob pattern (e.g., `src/legacy/**/*.ts`)
3. Optionally specify a rule ID pattern (e.g., `VC-AUTH-*`)
4. Provide a reason
5. View simulated impact

### Simulation Results

The simulation banner shows:
- **Original**: Findings before simulation
- **Simulated**: Findings after applying overrides
- **Pass/Fail**: Whether the policy would pass with these changes

### Exporting Waivers

If you simulate waivers and want to make them permanent:

1. Apply waiver simulations to desired findings
2. Click "Copy Waivers JSON"
3. Paste into your waivers configuration file

---

## Findings Table

The findings table provides a detailed list of all findings.

### Columns

| Column | Description |
|--------|-------------|
| Severity | Critical/High/Medium/Low/Info |
| Rule | Rule ID that triggered the finding |
| Title | Short description |
| File | Source file and line number |
| Category | Finding category (auth, validation, etc.) |
| Confidence | How confident the scanner is (0-100%) |

### Filtering

Filter findings by:
- **Severity**: Show only critical, high, etc.
- **Category**: auth, validation, network, etc.
- **Rule**: Specific rule IDs
- **File**: Specific files or patterns
- **Search**: Free-text search in titles

### Sorting

Click column headers to sort:
- Click once for ascending
- Click again for descending

### Actions

Each finding row provides actions:
- **View Evidence**: See code snippets and file locations
- **View Proof Trace**: See the trace that led to this finding
- **Simulate**: What-If actions (when mode is enabled)

---

## Proof Trace Timeline

Each finding includes a proof trace showing how it was detected.

### Reading Traces

The timeline shows the analysis path:

```
Route Handler
    ↓
Auth Check Missing  ← Problem identified
    ↓
Database Write      ← State-changing operation
```

### Node Types

| Type | Meaning |
|------|---------|
| Route | Entry point (API route handler) |
| Check | Security check (auth, validation) |
| Call | Function call |
| Database | Database operation |
| External | External API call |
| Gap | Missing protection (problem) |

### Evidence Links

Each trace node includes:
- File path and line number
- Code snippet (when available)
- Click to jump to source

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `/` | Focus search |
| `g` then `h` | Go to heatmap |
| `g` then `g` | Go to graph |
| `g` then `f` | Go to findings |
| `?` | Show keyboard shortcuts |
| `Escape` | Close modals/dropdowns |

---

## Dark/Light Mode

The viewer supports both dark and light themes:
- Automatically matches system preference
- Toggle via theme switcher in header
- Theme persists across sessions

---

## Exporting Results

### Copy Report

Click "Copy Report" to copy a markdown summary to clipboard. Useful for sharing in issues or documentation.

### Download PDF

Generate a PDF report with:
- Executive summary
- Finding details
- Remediation guidance
- Evidence screenshots

### Download Artifact

Download the raw JSON artifact for:
- Archiving
- CI/CD integration
- Comparison with baseline

---

## Tips

### Identifying Priority Issues

1. Start with the **Architecture Graph** to see high-risk clusters
2. Check the **Heatmap** for routes with multiple gaps
3. Review **Critical** and **High** findings first
4. Use **What-If** to simulate fixes before implementing

### Understanding Correlations

Correlation findings (VC-CORR-*) link related issues:
- Click related finding links to see connections
- Use the graph to visualize relationships
- Address root causes to fix multiple findings

### Baseline Comparison

When viewing with a baseline:
- New findings are highlighted
- Fixed findings are shown as resolved
- Regressions are flagged prominently
