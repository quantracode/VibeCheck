import { StyleSheet, Font } from "@react-pdf/renderer";

// Register fonts (using system fonts for now)
Font.register({
  family: "Helvetica",
  fonts: [
    { src: "Helvetica" },
    { src: "Helvetica-Bold", fontWeight: "bold" },
  ],
});

// Color palette
export const colors = {
  primary: "#6366f1",
  background: "#0a0a0f",
  card: "#111118",
  border: "#1e1e2e",
  text: "#e4e4e7",
  textMuted: "#71717a",

  // Severity colors
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#3b82f6",
  info: "#64748b",

  // Status colors
  pass: "#10b981",
  warn: "#eab308",
  fail: "#ef4444",

  // Accent
  emerald: "#10b981",
  purple: "#a855f7",
};

export const styles = StyleSheet.create({
  // Page styles
  page: {
    padding: 40,
    backgroundColor: "#ffffff",
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1a1a1a",
  },

  // Cover page
  coverPage: {
    padding: 60,
    backgroundColor: "#0a0a0f",
    justifyContent: "center",
    alignItems: "center",
  },
  coverTitle: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 8,
  },
  coverSubtitle: {
    fontSize: 16,
    color: "#a1a1aa",
    marginBottom: 40,
  },
  coverMeta: {
    fontSize: 11,
    color: "#71717a",
    marginTop: 4,
  },

  // Section headers
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: "#6366f1",
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginTop: 16,
    marginBottom: 8,
  },

  // Text styles
  text: {
    fontSize: 10,
    color: "#374151",
    lineHeight: 1.5,
  },
  textSmall: {
    fontSize: 9,
    color: "#6b7280",
  },
  textBold: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#1a1a1a",
  },
  textMono: {
    fontSize: 9,
    fontFamily: "Courier",
    color: "#374151",
  },

  // Layout
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  spaceBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  // Cards/Boxes
  card: {
    backgroundColor: "#f9fafb",
    borderRadius: 4,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },

  // Tables
  table: {
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tableCell: {
    fontSize: 9,
    color: "#374151",
  },
  tableCellHeader: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#1a1a1a",
  },

  // Badges
  badge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    fontSize: 8,
    fontWeight: "bold",
  },
  badgeCritical: {
    backgroundColor: "#fef2f2",
    color: "#dc2626",
  },
  badgeHigh: {
    backgroundColor: "#fff7ed",
    color: "#ea580c",
  },
  badgeMedium: {
    backgroundColor: "#fefce8",
    color: "#ca8a04",
  },
  badgeLow: {
    backgroundColor: "#eff6ff",
    color: "#2563eb",
  },
  badgeInfo: {
    backgroundColor: "#f8fafc",
    color: "#475569",
  },
  badgePass: {
    backgroundColor: "#ecfdf5",
    color: "#059669",
  },
  badgeWarn: {
    backgroundColor: "#fefce8",
    color: "#ca8a04",
  },
  badgeFail: {
    backgroundColor: "#fef2f2",
    color: "#dc2626",
  },

  // Code blocks
  codeBlock: {
    backgroundColor: "#1e1e2e",
    borderRadius: 4,
    padding: 10,
    marginTop: 8,
  },
  codeLine: {
    fontSize: 8,
    fontFamily: "Courier",
    color: "#e4e4e7",
    lineHeight: 1.4,
  },
  codeLineNumber: {
    fontSize: 8,
    fontFamily: "Courier",
    color: "#6b7280",
    width: 24,
  },

  // Metrics
  metricBox: {
    backgroundColor: "#f9fafb",
    borderRadius: 4,
    padding: 12,
    alignItems: "center",
    flex: 1,
    marginHorizontal: 4,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1a1a1a",
  },
  metricLabel: {
    fontSize: 9,
    color: "#6b7280",
    marginTop: 4,
  },

  // Proof trace
  proofStep: {
    flexDirection: "row",
    marginBottom: 8,
  },
  proofStepNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#6366f1",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  proofStepNumberText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#ffffff",
  },
  proofStepContent: {
    flex: 1,
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#9ca3af",
  },

  // Spacing utilities
  mb4: { marginBottom: 4 },
  mb8: { marginBottom: 8 },
  mb12: { marginBottom: 12 },
  mb16: { marginBottom: 16 },
  mb24: { marginBottom: 24 },
  mt8: { marginTop: 8 },
  mt16: { marginTop: 16 },
  mr4: { marginRight: 4 },
  mr8: { marginRight: 8 },
  gap4: { gap: 4 },
  gap8: { gap: 8 },
});

export const getSeverityBadgeStyle = (severity: string) => {
  switch (severity.toLowerCase()) {
    case "critical":
      return styles.badgeCritical;
    case "high":
      return styles.badgeHigh;
    case "medium":
      return styles.badgeMedium;
    case "low":
      return styles.badgeLow;
    default:
      return styles.badgeInfo;
  }
};

export const getStatusBadgeStyle = (status: string) => {
  switch (status) {
    case "pass":
      return styles.badgePass;
    case "warn":
      return styles.badgeWarn;
    case "fail":
      return styles.badgeFail;
    default:
      return styles.badgeInfo;
  }
};
