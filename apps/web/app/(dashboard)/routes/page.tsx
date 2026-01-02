"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Filter,
  X,
  FileSearch,
  Upload,
  Shield,
  ShieldOff,
  CheckCircle2,
  XCircle,
  FileCode,
  ChevronDown,
  ChevronRight,
  GitBranch,
} from "lucide-react";
import Link from "next/link";
import { useArtifactStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";

type HttpMethod = "all" | "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type CoverageFilter = "all" | "covered" | "uncovered";
type AuthFilter = "all" | "protected" | "unprotected";

interface Route {
  routeId: string;
  method: string;
  path: string;
  file: string;
  startLine?: number;
  endLine?: number;
  line?: number; // legacy format
}

interface MiddlewareCoverage {
  routeId: string;
  covered: boolean;
  reason?: string;
}

interface ProofTrace {
  summary: string;
  nodes: Array<{ kind: string; label: string; file?: string; line?: number }>;
}

const methodOptions: { value: HttpMethod; label: string }[] = [
  { value: "all", label: "All Methods" },
  { value: "GET", label: "GET" },
  { value: "POST", label: "POST" },
  { value: "PUT", label: "PUT" },
  { value: "PATCH", label: "PATCH" },
  { value: "DELETE", label: "DELETE" },
];

const coverageOptions: { value: CoverageFilter; label: string }[] = [
  { value: "all", label: "All Coverage" },
  { value: "covered", label: "Covered by Middleware" },
  { value: "uncovered", label: "Not Covered" },
];

const authOptions: { value: AuthFilter; label: string }[] = [
  { value: "all", label: "All Auth Status" },
  { value: "protected", label: "Auth Protected" },
  { value: "unprotected", label: "No Auth" },
];

const methodColors: Record<string, string> = {
  GET: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  POST: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  PUT: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
  PATCH: "bg-orange-500/10 text-orange-500 border-orange-500/30",
  DELETE: "bg-red-500/10 text-red-500 border-red-500/30",
  HEAD: "bg-purple-500/10 text-purple-500 border-purple-500/30",
  OPTIONS: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
};

function RouteRow({
  route,
  isCovered,
  hasAuth,
  proofTrace,
}: {
  route: Route;
  isCovered: boolean;
  hasAuth: boolean;
  proofTrace?: ProofTrace;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const methodColor = methodColors[route.method] ?? methodColors.GET;
  const line = route.startLine ?? route.line ?? 0;
  const hasNodes = proofTrace && proofTrace.nodes && proofTrace.nodes.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border bg-card/50 hover:bg-card transition-colors overflow-hidden"
    >
      <div
        className={cn(
          "p-4 flex items-start justify-between gap-4",
          hasNodes && "cursor-pointer"
        )}
        onClick={() => hasNodes && setIsExpanded(!isExpanded)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("px-2 py-0.5 rounded text-xs font-mono font-bold border", methodColor)}>
              {route.method}
            </span>
            <span className="font-mono text-sm">{route.path}</span>
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {isCovered ? (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
                <Shield className="w-3 h-3" />
                Middleware
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-zinc-500/10 text-zinc-400 border border-zinc-500/30">
                <ShieldOff className="w-3 h-3" />
                No Middleware
              </span>
            )}
            {hasAuth ? (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
                <CheckCircle2 className="w-3 h-3" />
                Auth
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-yellow-500/10 text-yellow-500 border border-yellow-500/30">
                <XCircle className="w-3 h-3" />
                No Auth
              </span>
            )}
            {hasNodes && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-blue-500/10 text-blue-500 border border-blue-500/30">
                <GitBranch className="w-3 h-3" />
                {proofTrace.nodes.length} trace step{proofTrace.nodes.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="flex items-center gap-1 text-xs text-muted-foreground font-mono mt-2">
            <FileCode className="w-3 h-3" />
            {route.file}:{line}
          </p>
          {proofTrace && (
            <p className="text-xs text-muted-foreground mt-1 italic">
              {proofTrace.summary}
            </p>
          )}
        </div>
        {hasNodes && (
          <div className="text-muted-foreground mt-1">
            {isExpanded ? (
              <ChevronDown className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </div>
        )}
      </div>

      {/* Proof Trace Timeline */}
      <AnimatePresence>
        {isExpanded && hasNodes && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t bg-muted/30"
          >
            <div className="p-4">
              <h4 className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <GitBranch className="w-3 h-3" />
                Proof Trace
              </h4>
              <div className="space-y-2 relative">
                {/* Vertical line connecting nodes */}
                <div className="absolute left-[7px] top-3 bottom-3 w-px bg-border" />

                {proofTrace.nodes.map((node, idx) => (
                  <div key={idx} className="flex items-start gap-3 relative">
                    {/* Node indicator */}
                    <div className={cn(
                      "w-4 h-4 rounded-full border-2 bg-background flex-shrink-0 mt-0.5 z-10",
                      node.kind === "route" && "border-blue-500",
                      node.kind === "middleware" && "border-emerald-500",
                      node.kind === "handler" && "border-purple-500",
                      node.kind === "function" && "border-yellow-500",
                      node.kind === "sink" && "border-red-500",
                      node.kind === "config" && "border-cyan-500",
                      !["route", "middleware", "handler", "function", "sink", "config"].includes(node.kind) && "border-zinc-500"
                    )} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-medium uppercase",
                          node.kind === "route" && "bg-blue-500/10 text-blue-500",
                          node.kind === "middleware" && "bg-emerald-500/10 text-emerald-500",
                          node.kind === "handler" && "bg-purple-500/10 text-purple-500",
                          node.kind === "function" && "bg-yellow-500/10 text-yellow-500",
                          node.kind === "sink" && "bg-red-500/10 text-red-500",
                          node.kind === "config" && "bg-cyan-500/10 text-cyan-500",
                          !["route", "middleware", "handler", "function", "sink", "config"].includes(node.kind) && "bg-zinc-500/10 text-zinc-400"
                        )}>
                          {node.kind}
                        </span>
                        <span className="text-sm">{node.label}</span>
                      </div>
                      {node.file && (
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">
                          {node.file}{node.line ? `:${node.line}` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function CoverageCard({
  title,
  covered,
  total,
  icon: Icon,
}: {
  title: string;
  covered: number;
  total: number;
  icon: typeof Shield;
}) {
  const percentage = total > 0 ? Math.round((covered / total) * 100) : 100;
  const color = percentage >= 80 ? "text-emerald-500" : percentage >= 50 ? "text-yellow-500" : "text-red-500";

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center bg-muted", color)}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className={cn("text-xl font-bold", color)}>
              {percentage}%
              <span className="text-sm font-normal text-muted-foreground ml-1">
                ({covered}/{total})
              </span>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function RoutesPage() {
  const { artifacts, selectedArtifactId } = useArtifactStore();
  const selectedArtifact = useMemo(
    () => artifacts.find((a) => a.id === selectedArtifactId),
    [artifacts, selectedArtifactId]
  );

  // Extract routes from artifact
  const routes: Route[] = useMemo(() => {
    const routeMap = selectedArtifact?.artifact.routeMap;
    if (!routeMap) return [];
    // Handle both object format { routes: [...] } and direct array
    if (Array.isArray(routeMap)) return routeMap as Route[];
    if ("routes" in routeMap && Array.isArray(routeMap.routes)) {
      return routeMap.routes as Route[];
    }
    return [];
  }, [selectedArtifact]);

  // Extract middleware coverage
  const middlewareCoverage = useMemo(() => {
    const map = selectedArtifact?.artifact.middlewareMap;
    if (!map) return new Map<string, boolean>();

    // Handle object format { coverage: [...] }
    if (typeof map === "object" && "coverage" in map && Array.isArray(map.coverage)) {
      const coverageMap = new Map<string, boolean>();
      for (const c of map.coverage as MiddlewareCoverage[]) {
        coverageMap.set(c.routeId, c.covered);
      }
      return coverageMap;
    }

    return new Map<string, boolean>();
  }, [selectedArtifact]);

  // Extract proof traces
  const proofTraces = useMemo(() => {
    const traces = selectedArtifact?.artifact.proofTraces;
    if (!traces || typeof traces !== "object") return new Map<string, ProofTrace>();
    return new Map(Object.entries(traces as Record<string, ProofTrace>));
  }, [selectedArtifact]);

  // Determine which routes have auth
  const authStatus = useMemo(() => {
    const status = new Map<string, boolean>();
    for (const route of routes) {
      const trace = proofTraces.get(route.routeId);
      // Auth is proven if summary mentions "auth" or if covered by middleware
      const hasAuth = trace?.summary?.toLowerCase().includes("auth") ||
                     middlewareCoverage.get(route.routeId) === true;
      status.set(route.routeId, hasAuth);
    }
    return status;
  }, [routes, proofTraces, middlewareCoverage]);

  // Coverage metrics
  const metrics = useMemo(() => {
    const covered = routes.filter((r) => middlewareCoverage.get(r.routeId) === true).length;
    const authProtected = routes.filter((r) => authStatus.get(r.routeId) === true).length;
    const stateChanging = routes.filter((r) => ["POST", "PUT", "PATCH", "DELETE"].includes(r.method));
    const stateChangingProtected = stateChanging.filter((r) => authStatus.get(r.routeId) === true).length;

    return {
      middlewareCovered: covered,
      authProtected,
      totalRoutes: routes.length,
      stateChangingRoutes: stateChanging.length,
      stateChangingProtected,
    };
  }, [routes, middlewareCoverage, authStatus]);

  const [filter, setFilter] = useState({
    method: "all" as HttpMethod,
    coverage: "all" as CoverageFilter,
    auth: "all" as AuthFilter,
    search: "",
  });

  const filteredRoutes = useMemo(() => {
    let result = [...routes];

    if (filter.method !== "all") {
      result = result.filter((r) => r.method === filter.method);
    }
    if (filter.coverage !== "all") {
      const wantCovered = filter.coverage === "covered";
      result = result.filter((r) => middlewareCoverage.get(r.routeId) === wantCovered);
    }
    if (filter.auth !== "all") {
      const wantAuth = filter.auth === "protected";
      result = result.filter((r) => authStatus.get(r.routeId) === wantAuth);
    }
    if (filter.search.trim()) {
      const searchLower = filter.search.toLowerCase();
      result = result.filter(
        (r) =>
          r.path.toLowerCase().includes(searchLower) ||
          r.file.toLowerCase().includes(searchLower)
      );
    }

    // Sort by path
    result.sort((a, b) => a.path.localeCompare(b.path));

    return result;
  }, [routes, filter, middlewareCoverage, authStatus]);

  const hasActiveFilters =
    filter.method !== "all" ||
    filter.coverage !== "all" ||
    filter.auth !== "all" ||
    filter.search.trim() !== "";

  const clearFilters = () => {
    setFilter({ method: "all", coverage: "all", auth: "all", search: "" });
  };

  // No artifact loaded
  if (!selectedArtifact) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API Routes</h1>
          <p className="text-muted-foreground mt-1">
            Route map with middleware coverage and auth status
          </p>
        </div>
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<Upload className="w-8 h-8 text-muted-foreground" />}
              title="No artifact loaded"
              description="Import a scan artifact from the Dashboard to view routes."
              action={
                <Link href="/">
                  <Button>Go to Dashboard</Button>
                </Link>
              }
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // No routes in artifact
  if (routes.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API Routes</h1>
          <p className="text-muted-foreground mt-1">
            Route map with middleware coverage and auth status
          </p>
        </div>
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<FileSearch className="w-8 h-8 text-muted-foreground" />}
              title="No routes found"
              description="This artifact doesn't contain route data. Re-scan with --emit-route-map to generate it."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API Routes</h1>
          <p className="text-muted-foreground mt-1">
            <span className="font-semibold text-foreground tabular-nums">
              {filteredRoutes.length}
            </span>
            {hasActiveFilters && (
              <span>
                {" "}
                of{" "}
                <span className="font-semibold text-foreground tabular-nums">
                  {routes.length}
                </span>
              </span>
            )}{" "}
            route{filteredRoutes.length !== 1 ? "s" : ""}
            {hasActiveFilters && " matching filters"}
          </p>
        </div>
      </div>

      {/* Coverage Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <CoverageCard
          title="Middleware Coverage"
          covered={metrics.middlewareCovered}
          total={metrics.totalRoutes}
          icon={Shield}
        />
        <CoverageCard
          title="Auth Coverage (All)"
          covered={metrics.authProtected}
          total={metrics.totalRoutes}
          icon={CheckCircle2}
        />
        <CoverageCard
          title="Auth Coverage (State-Changing)"
          covered={metrics.stateChangingProtected}
          total={metrics.stateChangingRoutes}
          icon={Shield}
        />
      </div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-wrap items-center gap-3"
      >
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search routes..."
            value={filter.search}
            onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
            className="pl-9"
            aria-label="Search routes"
          />
        </div>

        <Select
          value={filter.method}
          onValueChange={(value) => setFilter((f) => ({ ...f, method: value as HttpMethod }))}
        >
          <SelectTrigger className="w-[140px]" aria-label="Filter by method">
            <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Method" />
          </SelectTrigger>
          <SelectContent>
            {methodOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filter.coverage}
          onValueChange={(value) => setFilter((f) => ({ ...f, coverage: value as CoverageFilter }))}
        >
          <SelectTrigger className="w-[180px]" aria-label="Filter by coverage">
            <SelectValue placeholder="Coverage" />
          </SelectTrigger>
          <SelectContent>
            {coverageOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filter.auth}
          onValueChange={(value) => setFilter((f) => ({ ...f, auth: value as AuthFilter }))}
        >
          <SelectTrigger className="w-[160px]" aria-label="Filter by auth">
            <SelectValue placeholder="Auth" />
          </SelectTrigger>
          <SelectContent>
            {authOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-muted-foreground"
          >
            <X className="w-4 h-4 mr-1" />
            Clear filters
          </Button>
        )}
      </motion.div>

      {/* Route List */}
      {filteredRoutes.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<FileSearch className="w-8 h-8 text-muted-foreground" />}
              title={hasActiveFilters ? "No matching routes" : "No routes"}
              description={
                hasActiveFilters
                  ? "Try adjusting your filters to see more results."
                  : "No API routes were found in the codebase."
              }
              action={
                hasActiveFilters ? (
                  <Button variant="outline" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          </CardContent>
        </Card>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, delay: 0.1 }}
          className="space-y-3"
        >
          {filteredRoutes.map((route) => (
            <RouteRow
              key={route.routeId}
              route={route}
              isCovered={middlewareCoverage.get(route.routeId) === true}
              hasAuth={authStatus.get(route.routeId) === true}
              proofTrace={proofTraces.get(route.routeId)}
            />
          ))}
        </motion.div>
      )}
    </div>
  );
}
