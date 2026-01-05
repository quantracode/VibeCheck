"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Search,
  Filter,
  X,
  Upload,
  FileSearch,
  AlertTriangle,
  Shield,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import Link from "next/link";
import { useArtifactStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";
import {
  buildHeatmapData,
  buildCoverageRadarData,
  filterHeatmapData,
  type HeatmapData,
  type CoverageRadarData,
} from "@/lib/heatmap-builder";
import { RouteHeatmap, HeatmapSummary } from "@/components/RouteHeatmap";
import { CoverageRadar, CoverageRadarLegend } from "@/components/CoverageRadar";

// ============================================================================
// Component
// ============================================================================

export default function CoveragePage() {
  const router = useRouter();
  const { artifacts, selectedArtifactId } = useArtifactStore();

  const selectedArtifact = useMemo(
    () => artifacts.find((a) => a.id === selectedArtifactId),
    [artifacts, selectedArtifactId]
  );

  // Filter state
  const [filters, setFilters] = useState({
    stateChangingOnly: false,
    gapsOnly: false,
    searchQuery: "",
  });

  // Build base heatmap data
  const baseHeatmapData = useMemo<HeatmapData | null>(() => {
    if (!selectedArtifact) return null;
    return buildHeatmapData(selectedArtifact.artifact);
  }, [selectedArtifact]);

  // Build filtered heatmap data
  const filteredHeatmapData = useMemo<HeatmapData | null>(() => {
    if (!baseHeatmapData) return null;
    return filterHeatmapData(baseHeatmapData, filters);
  }, [baseHeatmapData, filters]);

  // Build coverage radar data
  const radarData = useMemo<CoverageRadarData | null>(() => {
    if (!selectedArtifact) return null;
    return buildCoverageRadarData(selectedArtifact.artifact);
  }, [selectedArtifact]);

  // Handle route click - navigate to findings filtered by route
  const handleRouteClick = useCallback(
    (routeId: string) => {
      const route = filteredHeatmapData?.routes.find((r) => r.routeId === routeId);
      if (route) {
        // Navigate to findings page filtered by the route's file
        router.push(`/findings?file=${encodeURIComponent(route.file)}`);
      }
    },
    [filteredHeatmapData, router]
  );

  // Check if any filters are active
  const hasActiveFilters =
    filters.stateChangingOnly ||
    filters.gapsOnly ||
    filters.searchQuery.trim() !== "";

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      stateChangingOnly: false,
      gapsOnly: false,
      searchQuery: "",
    });
  };

  // No artifact loaded
  if (!selectedArtifact) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Security Coverage</h1>
          <p className="text-muted-foreground mt-1">
            Route protection heatmap and coverage radar
          </p>
        </div>
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<Upload className="w-8 h-8 text-muted-foreground" />}
              title="No artifact loaded"
              description="Import a scan artifact from the Dashboard to view security coverage."
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
  if (!baseHeatmapData || baseHeatmapData.routes.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Security Coverage</h1>
          <p className="text-muted-foreground mt-1">
            Route protection heatmap and coverage radar
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
          <h1 className="text-3xl font-bold tracking-tight">Security Coverage</h1>
          <p className="text-muted-foreground mt-1">
            <span className="font-semibold text-foreground tabular-nums">
              {filteredHeatmapData?.routes.length ?? 0}
            </span>
            {hasActiveFilters && (
              <span>
                {" "}
                of{" "}
                <span className="font-semibold text-foreground tabular-nums">
                  {baseHeatmapData.routes.length}
                </span>
              </span>
            )}{" "}
            route{(filteredHeatmapData?.routes.length ?? 0) !== 1 ? "s" : ""}
            {hasActiveFilters && " matching filters"}
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Routes"
          value={baseHeatmapData.summary.totalRoutes}
          icon={Shield}
          color="text-blue-500"
        />
        <SummaryCard
          title="State-Changing"
          value={baseHeatmapData.summary.stateChangingRoutes}
          icon={ShieldCheck}
          color="text-purple-500"
        />
        <SummaryCard
          title="Routes with Gaps"
          value={baseHeatmapData.summary.routesWithGaps}
          icon={ShieldOff}
          color={baseHeatmapData.summary.routesWithGaps > 0 ? "text-red-500" : "text-emerald-500"}
        />
        <SummaryCard
          title="Findings"
          value={selectedArtifact.artifact.findings.length}
          icon={AlertTriangle}
          color={
            selectedArtifact.artifact.findings.length > 0
              ? "text-amber-500"
              : "text-emerald-500"
          }
        />
      </div>

      {/* Coverage Radar + Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Coverage Radar</CardTitle>
            <p className="text-sm text-muted-foreground">
              Multi-dimensional view of security coverage
            </p>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            {radarData && (
              <>
                <CoverageRadar data={radarData} size={350} />
                <CoverageRadarLegend data={radarData} className="mt-4 w-full" />
              </>
            )}
          </CardContent>
        </Card>

        {/* Protection Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Protection Summary</CardTitle>
            <p className="text-sm text-muted-foreground">
              Coverage by protection category
            </p>
          </CardHeader>
          <CardContent>
            {filteredHeatmapData && (
              <HeatmapSummary data={filteredHeatmapData} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-wrap items-center gap-4 p-4 bg-muted/30 rounded-lg"
      >
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search routes..."
            value={filters.searchQuery}
            onChange={(e) =>
              setFilters((f) => ({ ...f, searchQuery: e.target.value }))
            }
            className="pl-9"
            aria-label="Search routes"
          />
        </div>

        {/* Toggle filters */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Switch
              id="state-changing"
              checked={filters.stateChangingOnly}
              onCheckedChange={(checked: boolean) =>
                setFilters((f) => ({ ...f, stateChangingOnly: checked }))
              }
            />
            <Label
              htmlFor="state-changing"
              className="text-sm cursor-pointer flex items-center gap-1.5"
            >
              <Filter className="w-3.5 h-3.5" />
              State-changing only
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="gaps-only"
              checked={filters.gapsOnly}
              onCheckedChange={(checked: boolean) =>
                setFilters((f) => ({ ...f, gapsOnly: checked }))
              }
            />
            <Label
              htmlFor="gaps-only"
              className="text-sm cursor-pointer flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Routes with gaps only
            </Label>
          </div>

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
        </div>
      </motion.div>

      {/* Route Heatmap */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Route Protection Heatmap</CardTitle>
          <p className="text-sm text-muted-foreground">
            Click a route to view its findings. Expand for details.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {filteredHeatmapData && filteredHeatmapData.routes.length > 0 ? (
            <RouteHeatmap
              data={filteredHeatmapData}
              onRouteClick={handleRouteClick}
              className="px-4 pb-4"
            />
          ) : (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Summary Card Component
// ============================================================================

function SummaryCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: number;
  icon: typeof Shield;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center bg-muted", color)}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className={cn("text-2xl font-bold tabular-nums", color)}>
              {value}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
