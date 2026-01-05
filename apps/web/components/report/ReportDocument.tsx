import {
  Document,
  Page,
  Text,
  View,
  Link,
} from "@react-pdf/renderer";
import type { ScanArtifact, Finding } from "@vibecheck/schema";
import type { Waiver, PolicyReport, WaivedFinding } from "@vibecheck/policy";
import { styles, getSeverityBadgeStyle, getStatusBadgeStyle } from "./styles";

interface ReportData {
  artifact: ScanArtifact;
  policyReport: PolicyReport | null;
  waivers: Waiver[];
  waivedFindings: WaivedFinding[];
  activeFindings: Finding[];
  generatedAt: string;
  profile: string;
  /** SHA-256 hash of report data for integrity verification */
  integrityHash?: string;
}

// Cover Page
function CoverPage({ data }: { data: ReportData }) {
  const score = calculateSecurityScore(data.activeFindings);
  const statusLabel = data.policyReport?.status.toUpperCase() ?? "N/A";

  return (
    <Page size="A4" style={styles.coverPage}>
      <View style={{ alignItems: "center" }}>
        <Text style={styles.coverTitle}>Security Audit Report</Text>
        <Text style={styles.coverSubtitle}>VibeCheck Security Analysis</Text>

        <View style={{ marginTop: 40, alignItems: "center" }}>
          <Text style={{ fontSize: 72, fontWeight: "bold", color: getScoreColor(score) }}>
            {score}
          </Text>
          <Text style={{ fontSize: 14, color: "#a1a1aa", marginTop: 4 }}>
            Security Score
          </Text>
        </View>

        <View style={{ marginTop: 40, alignItems: "center" }}>
          <View
            style={[
              styles.badge,
              getStatusBadgeStyle(data.policyReport?.status ?? "info"),
              { paddingVertical: 6, paddingHorizontal: 16, fontSize: 12 },
            ]}
          >
            <Text>{statusLabel}</Text>
          </View>
        </View>

        <View style={{ marginTop: 60, alignItems: "center" }}>
          <Text style={styles.coverMeta}>
            Repository: {data.artifact.repo?.name ?? "Unknown"}
          </Text>
          <Text style={styles.coverMeta}>
            Scan Date: {new Date(data.artifact.generatedAt).toLocaleString()}
          </Text>
          <Text style={styles.coverMeta}>
            Report Generated: {new Date(data.generatedAt).toLocaleString()}
          </Text>
          <Text style={styles.coverMeta}>
            Scanner Version: {data.artifact.tool?.version ?? "Unknown"}
          </Text>
          <Text style={styles.coverMeta}>
            Policy Profile: {data.profile}
          </Text>
        </View>
      </View>
    </Page>
  );
}

// Executive Summary Page
function ExecutiveSummaryPage({ data }: { data: ReportData }) {
  const severityCounts = getSeverityCounts(data.activeFindings);
  const score = calculateSecurityScore(data.activeFindings);

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.sectionTitle}>Executive Summary</Text>

      {/* Score and Status */}
      <View style={[styles.row, styles.mb16, { gap: 16 }]}>
        <View style={[styles.metricBox, { backgroundColor: "#f0fdf4" }]}>
          <Text style={[styles.metricValue, { color: getScoreColor(score) }]}>
            {score}/100
          </Text>
          <Text style={styles.metricLabel}>Security Score</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={styles.metricValue}>{data.activeFindings.length}</Text>
          <Text style={styles.metricLabel}>Active Findings</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={[styles.metricValue, { color: "#10b981" }]}>
            {data.waivedFindings.length}
          </Text>
          <Text style={styles.metricLabel}>Waived</Text>
        </View>
      </View>

      {/* Policy Status */}
      {data.policyReport && (
        <View style={[styles.card, styles.mb16]}>
          <View style={styles.cardHeader}>
            <Text style={styles.textBold}>Policy Evaluation Result</Text>
            <View style={[styles.badge, getStatusBadgeStyle(data.policyReport.status)]}>
              <Text>{data.policyReport.status.toUpperCase()}</Text>
            </View>
          </View>
          {data.policyReport.reasons.map((reason, i) => (
            <View key={i} style={[styles.row, styles.mb4]}>
              <Text style={styles.textSmall}>• {reason.message}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Findings by Severity */}
      <Text style={styles.subsectionTitle}>Findings by Severity</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCellHeader, { width: "25%" }]}>Severity</Text>
          <Text style={[styles.tableCellHeader, { width: "25%" }]}>Count</Text>
          <Text style={[styles.tableCellHeader, { width: "50%" }]}>Impact</Text>
        </View>
        {(["critical", "high", "medium", "low", "info"] as const).map((sev) => (
          <View key={sev} style={styles.tableRow}>
            <View style={{ width: "25%" }}>
              <View style={[styles.badge, getSeverityBadgeStyle(sev), { alignSelf: "flex-start" }]}>
                <Text>{sev.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={[styles.tableCell, { width: "25%" }]}>{severityCounts[sev]}</Text>
            <Text style={[styles.tableCell, { width: "50%" }]}>{getSeverityImpact(sev)}</Text>
          </View>
        ))}
      </View>

      {/* Coverage Metrics */}
      {data.artifact.metrics && (
        <>
          <Text style={styles.subsectionTitle}>Coverage Metrics</Text>
          <View style={[styles.row, { gap: 8 }]}>
            {data.artifact.metrics.authCoverage && (
              <CoverageMetricBox
                label="Auth Coverage"
                value={Math.round(
                  (data.artifact.metrics.authCoverage.protectedCount /
                    Math.max(data.artifact.metrics.authCoverage.totalStateChanging, 1)) *
                    100
                )}
              />
            )}
            {data.artifact.metrics.validationCoverage && (
              <CoverageMetricBox
                label="Validation"
                value={Math.round(
                  (data.artifact.metrics.validationCoverage.validatedCount /
                    Math.max(data.artifact.metrics.validationCoverage.totalStateChanging, 1)) *
                    100
                )}
              />
            )}
            {data.artifact.metrics.middlewareCoverage && (
              <CoverageMetricBox
                label="Middleware"
                value={Math.round(
                  (data.artifact.metrics.middlewareCoverage.coveredApiRoutes /
                    Math.max(data.artifact.metrics.middlewareCoverage.totalApiRoutes, 1)) *
                    100
                )}
              />
            )}
          </View>
        </>
      )}

      <PageFooter generatedAt={data.generatedAt} />
    </Page>
  );
}

function CoverageMetricBox({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? "#10b981" : value >= 50 ? "#eab308" : "#ef4444";
  return (
    <View style={[styles.metricBox, { flex: 1 }]}>
      <Text style={[styles.metricValue, { color, fontSize: 20 }]}>{value}%</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

// Waivers Page
function WaiversPage({ data }: { data: ReportData }) {
  if (data.waivers.length === 0) {
    return null;
  }

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.sectionTitle}>Waivers ({data.waivers.length})</Text>
      <Text style={[styles.text, styles.mb16]}>
        The following waivers have been applied to suppress specific findings from the policy evaluation.
      </Text>

      {data.waivers.map((waiver, index) => (
        <View key={waiver.id} style={[styles.card, styles.mb8]}>
          <View style={styles.cardHeader}>
            <Text style={styles.textBold}>Waiver #{index + 1}</Text>
            <Text style={styles.textMono}>{waiver.id}</Text>
          </View>

          <View style={[styles.row, styles.mb4]}>
            <Text style={[styles.textSmall, { width: 80 }]}>Match:</Text>
            <Text style={styles.textMono}>
              {waiver.match.fingerprint
                ? `Fingerprint: ${waiver.match.fingerprint}`
                : `Rule: ${waiver.match.ruleId}${waiver.match.pathPattern ? ` @ ${waiver.match.pathPattern}` : ""}`}
            </Text>
          </View>

          <View style={[styles.row, styles.mb4]}>
            <Text style={[styles.textSmall, { width: 80 }]}>Reason:</Text>
            <Text style={styles.text}>{waiver.reason}</Text>
          </View>

          <View style={[styles.row, styles.mb4]}>
            <Text style={[styles.textSmall, { width: 80 }]}>Created By:</Text>
            <Text style={styles.text}>{waiver.createdBy}</Text>
          </View>

          <View style={styles.row}>
            <Text style={[styles.textSmall, { width: 80 }]}>Created At:</Text>
            <Text style={styles.text}>{new Date(waiver.createdAt).toLocaleString()}</Text>
          </View>

          {waiver.expiresAt && (
            <View style={[styles.row, styles.mt8]}>
              <Text style={[styles.textSmall, { width: 80 }]}>Expires:</Text>
              <Text style={styles.text}>{new Date(waiver.expiresAt).toLocaleString()}</Text>
            </View>
          )}
        </View>
      ))}

      <PageFooter generatedAt={data.generatedAt} />
    </Page>
  );
}

// Findings Detail Pages
function FindingsPages({ data }: { data: ReportData }) {
  const allFindings = [...data.activeFindings];

  // Group findings into pages (roughly 2-3 per page depending on content)
  const pages: Finding[][] = [];
  let currentPage: Finding[] = [];

  allFindings.forEach((finding) => {
    currentPage.push(finding);
    // Simple heuristic: ~2 findings per page
    if (currentPage.length >= 2) {
      pages.push(currentPage);
      currentPage = [];
    }
  });
  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  if (pages.length === 0) {
    return (
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Findings</Text>
        <View style={[styles.card, { alignItems: "center", paddingVertical: 40 }]}>
          <Text style={[styles.textBold, { color: "#10b981", fontSize: 14 }]}>
            No Active Findings
          </Text>
          <Text style={[styles.text, styles.mt8]}>
            All findings have been addressed or waived.
          </Text>
        </View>
        <PageFooter generatedAt={data.generatedAt} />
      </Page>
    );
  }

  return (
    <>
      {pages.map((pageFindings, pageIndex) => (
        <Page key={pageIndex} size="A4" style={styles.page}>
          {pageIndex === 0 && (
            <Text style={styles.sectionTitle}>
              Findings ({data.activeFindings.length} Active)
            </Text>
          )}

          {pageFindings.map((finding) => (
            <FindingCard key={finding.id} finding={finding} />
          ))}

          <PageFooter generatedAt={data.generatedAt} />
        </Page>
      ))}
    </>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  return (
    <View style={[styles.card, styles.mb12]} wrap={false}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={[styles.row, { gap: 6, flexWrap: "wrap", flex: 1 }]}>
          <View style={[styles.badge, getSeverityBadgeStyle(finding.severity)]}>
            <Text>{finding.severity.toUpperCase()}</Text>
          </View>
          <Text style={styles.textMono}>{finding.ruleId}</Text>
          <Text style={[styles.textSmall, { textTransform: "capitalize" }]}>
            {finding.category}
          </Text>
        </View>
      </View>

      {/* Title & Description */}
      <Text style={[styles.textBold, styles.mb4]}>{finding.title}</Text>
      <Text style={[styles.text, styles.mb8]}>{finding.description}</Text>

      {/* Fingerprint */}
      <View style={[styles.row, styles.mb8]}>
        <Text style={styles.textSmall}>Fingerprint: </Text>
        <Text style={styles.textMono}>{finding.fingerprint}</Text>
      </View>

      {/* Evidence */}
      {finding.evidence.length > 0 && (
        <View style={styles.mb8}>
          <Text style={[styles.textSmall, styles.mb4]}>Evidence:</Text>
          {finding.evidence.slice(0, 2).map((ev, i) => (
            <View key={i} style={styles.mb4}>
              <Text style={styles.textMono}>
                {ev.file}:{ev.startLine}-{ev.endLine}
              </Text>
              {ev.snippet && (
                <View style={styles.codeBlock}>
                  {ev.snippet.split("\n").slice(0, 5).map((line, j) => (
                    <View key={j} style={[styles.row]}>
                      <Text style={styles.codeLineNumber}>{ev.startLine + j}</Text>
                      <Text style={styles.codeLine}>{line}</Text>
                    </View>
                  ))}
                  {ev.snippet.split("\n").length > 5 && (
                    <Text style={[styles.codeLine, { color: "#6b7280" }]}>
                      ... ({ev.snippet.split("\n").length - 5} more lines)
                    </Text>
                  )}
                </View>
              )}
            </View>
          ))}
          {finding.evidence.length > 2 && (
            <Text style={styles.textSmall}>
              +{finding.evidence.length - 2} more evidence locations
            </Text>
          )}
        </View>
      )}

      {/* Proof Trace */}
      {finding.proof && finding.proof.nodes.length > 0 && (
        <View style={styles.mb8}>
          <Text style={[styles.textSmall, styles.mb4]}>Proof Trace:</Text>
          <Text style={[styles.textSmall, styles.mb4, { fontStyle: "italic" }]}>
            {finding.proof.summary}
          </Text>
          {finding.proof.nodes.slice(0, 4).map((node, i) => (
            <View key={i} style={styles.proofStep}>
              <View style={styles.proofStepNumber}>
                <Text style={styles.proofStepNumberText}>{i + 1}</Text>
              </View>
              <View style={styles.proofStepContent}>
                <Text style={styles.textSmall}>[{node.kind}] {node.label}</Text>
                {node.file && (
                  <Text style={styles.textMono}>
                    {node.file}:{node.line}
                  </Text>
                )}
              </View>
            </View>
          ))}
          {finding.proof.nodes.length > 4 && (
            <Text style={styles.textSmall}>
              +{finding.proof.nodes.length - 4} more nodes
            </Text>
          )}
        </View>
      )}

      {/* Remediation */}
      <View style={[{ backgroundColor: "#f0fdf4", padding: 8, borderRadius: 4 }]}>
        <Text style={[styles.textSmall, { color: "#059669", fontWeight: "bold" }]}>
          Remediation:
        </Text>
        <Text style={[styles.textSmall, { color: "#047857" }]}>
          {finding.remediation.recommendedFix}
        </Text>
      </View>

      {/* References */}
      {finding.links && (finding.links.owasp || finding.links.cwe) && (
        <View style={[styles.row, styles.mt8, { gap: 12 }]}>
          {finding.links.owasp && (
            <Link src={finding.links.owasp} style={styles.textSmall}>
              <Text style={{ color: "#6366f1" }}>OWASP Reference</Text>
            </Link>
          )}
          {finding.links.cwe && (
            <Link src={finding.links.cwe} style={styles.textSmall}>
              <Text style={{ color: "#6366f1" }}>CWE Reference</Text>
            </Link>
          )}
        </View>
      )}
    </View>
  );
}

// Appendix Page
function AppendixPage({ data }: { data: ReportData }) {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.sectionTitle}>Appendix</Text>

      {/* Report Integrity */}
      <Text style={styles.subsectionTitle}>Report Integrity</Text>
      <View style={[styles.card, { backgroundColor: "#fef3c7", borderColor: "#fbbf24" }]}>
        <View style={styles.mb4}>
          <Text style={[styles.textSmall, { color: "#92400e", fontWeight: "bold" }]}>
            Integrity Hash (SHA-256)
          </Text>
          <Text style={[styles.textMono, { color: "#78350f", fontSize: 8, marginTop: 2 }]}>
            {data.integrityHash ?? "Not computed"}
          </Text>
        </View>
        <View style={styles.mb4}>
          <Text style={[styles.textSmall, { color: "#92400e", fontWeight: "bold" }]}>
            Report Generated
          </Text>
          <Text style={[styles.text, { color: "#78350f" }]}>
            {new Date(data.generatedAt).toISOString()}
          </Text>
        </View>
        <Text style={[styles.textSmall, { color: "#92400e", fontStyle: "italic" }]}>
          This hash is computed from the artifact data and findings. Use it to verify
          that this report has not been tampered with since generation.
        </Text>
      </View>

      {/* Artifact Metadata */}
      <Text style={styles.subsectionTitle}>Artifact Metadata</Text>
      <View style={styles.card}>
        <MetadataRow label="Artifact Version" value={data.artifact.artifactVersion} />
        <MetadataRow label="Tool Name" value={data.artifact.tool?.name ?? "Unknown"} />
        <MetadataRow label="Tool Version" value={data.artifact.tool?.version ?? "Unknown"} />
        <MetadataRow
          label="Scan Date"
          value={new Date(data.artifact.generatedAt).toLocaleString()}
        />
        {data.artifact.repo && (
          <>
            <MetadataRow label="Repository" value={data.artifact.repo.name} />
            {data.artifact.repo.git?.branch && (
              <MetadataRow label="Branch" value={data.artifact.repo.git.branch} />
            )}
            {data.artifact.repo.git?.commit && (
              <MetadataRow label="Commit" value={data.artifact.repo.git.commit} />
            )}
          </>
        )}
      </View>

      {/* Policy Configuration */}
      <Text style={styles.subsectionTitle}>Policy Configuration</Text>
      <View style={styles.card}>
        <MetadataRow label="Profile" value={data.profile} />
        {data.policyReport && (
          <>
            <MetadataRow
              label="Fail Threshold"
              value={data.policyReport.thresholds.failOnSeverity}
            />
            <MetadataRow
              label="Warn Threshold"
              value={data.policyReport.thresholds.warnOnSeverity}
            />
            <MetadataRow
              label="Min Confidence (Fail)"
              value={`${data.policyReport.thresholds.minConfidenceForFail * 100}%`}
            />
          </>
        )}
      </View>

      {/* Summary Statistics */}
      <Text style={styles.subsectionTitle}>Summary Statistics</Text>
      <View style={styles.card}>
        <MetadataRow
          label="Total Findings"
          value={String(data.activeFindings.length + data.waivedFindings.length)}
        />
        <MetadataRow label="Active Findings" value={String(data.activeFindings.length)} />
        <MetadataRow label="Waived Findings" value={String(data.waivedFindings.length)} />
        <MetadataRow label="Waivers Applied" value={String(data.waivers.length)} />
      </View>

      <PageFooter generatedAt={data.generatedAt} />
    </Page>
  );
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={[styles.row, styles.mb4]}>
      <Text style={[styles.textSmall, { width: 140 }]}>{label}:</Text>
      <Text style={styles.text}>{value}</Text>
    </View>
  );
}

function PageFooter({ generatedAt }: { generatedAt: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>VibeCheck Security Report</Text>
      <Text>Generated: {new Date(generatedAt).toLocaleDateString()}</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

// Utility functions
function getSeverityCounts(findings: Finding[]) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  findings.forEach((f) => {
    const sev = f.severity.toLowerCase() as keyof typeof counts;
    if (sev in counts) counts[sev]++;
  });
  return counts;
}

function calculateSecurityScore(findings: Finding[]) {
  const counts = getSeverityCounts(findings);
  const score = Math.max(
    0,
    100 - counts.critical * 25 - counts.high * 10 - counts.medium * 3 - counts.low * 1
  );
  return Math.round(score);
}

function getScoreColor(score: number): string {
  if (score >= 80) return "#10b981";
  if (score >= 50) return "#eab308";
  return "#ef4444";
}

function getSeverityImpact(severity: string): string {
  switch (severity) {
    case "critical":
      return "Immediate exploitation risk, severe impact";
    case "high":
      return "Significant security risk, priority fix needed";
    case "medium":
      return "Moderate risk, should be addressed";
    case "low":
      return "Minor concern, fix when convenient";
    case "info":
      return "Informational, best practice recommendation";
    default:
      return "";
  }
}

// Main Report Document
export function ReportDocument({ data }: { data: ReportData }) {
  return (
    <Document
      title={`VibeCheck Security Report - ${data.artifact.repo?.name ?? "Scan"}`}
      author="VibeCheck"
      subject="Security Audit Report"
      keywords="security, audit, vibecheck, scan"
      creator="VibeCheck Security Scanner"
      producer="@react-pdf/renderer"
    >
      <CoverPage data={data} />
      <ExecutiveSummaryPage data={data} />
      <WaiversPage data={data} />
      <FindingsPages data={data} />
      <AppendixPage data={data} />
    </Document>
  );
}

export type { ReportData };

/**
 * Compute SHA-256 hash of the report data for integrity verification
 */
export async function computeIntegrityHash(data: ReportData): Promise<string> {
  // Create a canonical representation of the data (excluding the hash itself)
  const dataToHash = {
    artifactVersion: data.artifact.artifactVersion,
    generatedAt: data.artifact.generatedAt,
    repo: data.artifact.repo?.name,
    commit: data.artifact.repo?.git?.commit,
    findingFingerprints: data.activeFindings.map((f) => f.fingerprint).sort(),
    waiverIds: data.waivers.map((w) => w.id).sort(),
    policyStatus: data.policyReport?.status,
    profile: data.profile,
    reportGeneratedAt: data.generatedAt,
  };

  const jsonString = JSON.stringify(dataToHash, null, 0);
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(jsonString);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
