# VibeCheck Security Philosophy

## Core Principles

VibeCheck is built on a simple premise: **security tools should find real problems, not generate noise.**

### 1. Conservative by Default

VibeCheck flags issues when we have reasonable confidence they represent genuine security risks. We would rather miss a theoretical vulnerability than waste developer time on false positives.

**What this means in practice:**
- Findings require multiple corroborating signals
- Confidence scores reflect actual detection reliability
- Severity reflects exploitability, not theoretical maximum impact

### 2. Enforcement-First

Security controls are only effective if enforced. A validation schema that exists but isn't used provides zero protection. VibeCheck specifically detects these gaps:

- Authentication code that doesn't gate access
- Validation logic whose output is ignored
- Security imports that are never called
- Comments that claim protection without implementation

We call these patterns **security hallucinations**—the appearance of security without substance.

### 3. Local-First, Privacy-Respecting

Your code never leaves your machine. VibeCheck runs entirely locally:
- No cloud services required
- No telemetry or analytics
- No code uploads or sharing
- Scan artifacts stay on your filesystem

This isn't just a feature—it's a requirement for enterprise adoption and responsible security tooling.

### 4. Deterministic and Reproducible

Given the same codebase, VibeCheck produces the same findings. There's no AI guessing, no probabilistic scanning, no "it depends on the day" results.

Every finding links to:
- Specific file and line numbers
- The exact pattern that triggered detection
- Reproducible evidence

### 5. Developer-Centric

Security tools often fail because they're built for auditors, not developers. VibeCheck is designed for the people who will actually fix the issues:

- Clear, actionable remediation guidance
- Integration with existing workflows (CLI, CI, IDE)
- Findings grouped by what needs to change, not by abstract vulnerability classes
- Exit codes that work with automation

---

## What We Don't Do

### No Vulnerability Databases

VibeCheck doesn't scan for CVEs or known vulnerabilities in dependencies. Tools like `npm audit`, Snyk, and Dependabot already do this well. We focus on **your code**, not third-party packages.

### No AI/LLM Analysis

We don't send your code to language models for analysis. While AI can find interesting patterns, it can't provide the deterministic, reproducible results required for security tooling in CI pipelines.

### No "Best Practice" Noise

We don't flag stylistic issues, coding conventions, or theoretical improvements. If it's not a security problem, it's not a finding.

### No Severity Inflation

A medium-confidence information disclosure is not "Critical" just because data might be sensitive. Severity reflects:
- Exploitability
- Authentication requirements
- Attack complexity
- Realistic impact

---

## Detection Philosophy

### Signal Over Noise

Every rule we ship must meet a threshold:
- **Precision**: >80% of findings should be true positives in real codebases
- **Actionability**: Developer can understand and fix without security expertise
- **Determinism**: Same code = same results

Rules that don't meet these thresholds are removed or refined, not shipped with lower severity.

### Evidence-Based Findings

Each finding includes:
- **Evidence**: The specific code patterns detected
- **Proof trace**: How we determined this is an issue
- **Context**: What signals contributed to the confidence score

This isn't just for transparency—it helps developers understand *why* something is flagged, not just *that* it's flagged.

### Framework Awareness

We don't scan "JavaScript files for security issues." We understand Next.js patterns:
- App Router vs Pages Router
- Route handlers vs API routes
- Server Components vs Client Components
- Middleware configuration

This framework awareness dramatically reduces false positives and enables detection of Next.js-specific issues.

---

## Severity Model

### Critical
Exploitable with no authentication, leads to data breach or system compromise.
- JWT decoded without verification
- Unprotected admin endpoints
- Hardcoded secrets in production paths

### High
Exploitable with some preconditions, significant impact.
- Unprotected state-changing endpoints
- SSRF with user-controlled URLs
- SQL injection patterns

### Medium
Requires specific conditions, limited impact, or defense-in-depth gap.
- Missing rate limiting on public endpoints
- Debug flags without environment guards
- Client-side only validation

### Low
Informational, hygiene issues, or minor gaps.
- Missing request timeouts
- Undocumented environment variables

---

## The Goal

VibeCheck exists because vibe-coding with AI assistants often produces code that *looks* secure but isn't. The patterns are familiar—validation schemas, auth checks, middleware—but the wiring is missing.

Our goal is simple: **Find the gap between intended security and actual security.**

When you run `vibecheck scan`, you should:
1. Get a small number of high-signal findings
2. Understand each one without security expertise
3. Know exactly what to fix
4. Trust that fixing them improves your security posture

That's it. No dashboards, no compliance theater, no security scores. Just findings that matter.
