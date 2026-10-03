import { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import { Paper, GraphNode, GraphLink } from "../types";
import { buildBipartiteGraph, buildPaperSimilarityGraph, getCategoryColor } from "../utils/graphUtils";
import { useTheme } from "../hooks/useTheme";
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Play, 
  Pause, 
  Layers, 
  GitFork, 
  Search, 
  ExternalLink,
  Filter
} from "lucide-react";

interface NetworkGraphProps {
  papers: Paper[];
  onSelectPaper: (paper: Paper) => void;
  onExploreTopic: (topic: string) => void;
}

export default function NetworkGraph({
  papers,
  onSelectPaper,
  onExploreTopic,
}: NetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [viewMode, setViewMode] = useState<"bipartite" | "similarity">("bipartite");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [chargeStrength] = useState(-180);
  const [linkDistance] = useState(70);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const allCategories = useMemo(() => {
    const cats = new Map<string, number>();
    papers.forEach((p) => {
      p.categories.forEach((c) => {
        cats.set(c, (cats.get(c) || 0) + 1);
      });
    });
    return Array.from(cats.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [papers]);

  const activeCategoriesSet = useMemo(() => {
    return selectedCategory ? new Set([selectedCategory]) : new Set<string>();
  }, [selectedCategory]);

  const { nodes, links } = useMemo(() => {
    if (viewMode === "bipartite") {
      return buildBipartiteGraph(papers, activeCategoriesSet, searchQuery);
    } else {
      return buildPaperSimilarityGraph(papers, activeCategoriesSet, searchQuery, 2);
    }
  }, [papers, activeCategoriesSet, searchQuery, viewMode]);

  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 900;
    const height = containerRef.current.clientHeight || 650;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g").attr("class", "graph-container");

    // Subtle dot grid
    const defs = svg.append("defs");
    const pattern = defs
      .append("pattern")
      .attr("id", "grid-pattern")
      .attr("width", 32)
      .attr("height", 32)
      .attr("patternUnits", "userSpaceOnUse");
    pattern
      .append("circle")
      .attr("cx", 1)
      .attr("cy", 1)
      .attr("r", 0.6)
      .attr("fill", isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.07)");

    g.append("rect")
      .attr("x", -5000)
      .attr("y", -5000)
      .attr("width", 10000)
      .attr("height", 10000)
      .attr("fill", "url(#grid-pattern)")
      .style("pointer-events", "none");

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    zoomRef.current = zoom;
    svg.call(zoom);

    svg.call(
      zoom.transform,
      d3.zoomIdentity.translate(width / 2, height / 2).scale(0.85)
    );

    const simNodes: GraphNode[] = nodes.map((d) => ({ ...d }));
    const simLinks: GraphLink[] = links.map((d) => ({ ...d }));

    const simulation = d3
      .forceSimulation<GraphNode>(simNodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(simLinks)
          .id((d) => d.id)
          .distance((d) => (d.type === "paper-category" ? linkDistance : linkDistance * 1.4))
      )
      .force("charge", d3.forceManyBody().strength(chargeStrength))
      .force("center", d3.forceCenter(0, 0))
      .force(
        "collision",
        d3.forceCollide<GraphNode>().radius((d) => d.radius + 6)
      )
      .alphaDecay(0.028);

    simulationRef.current = simulation;

    // Links
    const linkGroup = g.append("g").attr("class", "links");
    const link = linkGroup
      .selectAll("line")
      .data(simLinks)
      .enter()
      .append("line")
      .attr("stroke", (d) =>
        d.type === "paper-category"
          ? (isDark ? "#64748b" : "rgba(0,0,0,0.12)")
          : (isDark ? "#f87171" : "rgba(230, 57, 70, 0.25)")
      )
      .attr("stroke-width", (d) => (d.weight ? Math.min(3.5, 1.5 + d.weight * 0.6) : 1.5))
      .attr("stroke-dasharray", (d) => (d.type === "paper-category" ? "none" : "3,3"))
      .attr("opacity", isDark ? 0.5 : 0.8);

    // Nodes
    const nodeGroup = g.append("g").attr("class", "nodes");
    const node = nodeGroup
      .selectAll<SVGGElement, GraphNode>("g")
      .data(simNodes)
      .enter()
      .append("g")
      .attr("class", "cursor-pointer")
      .call(
        d3
          .drag<SVGGElement, GraphNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    // Category outer ring
    node
      .filter((d) => d.type === "category")
      .append("circle")
      .attr("r", (d) => d.radius + 3)
      .attr("fill", "transparent")
      .attr("stroke", (d) => d.color)
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.3);

    // Primary circle
    node
      .append("circle")
      .attr("r", (d) => d.radius)
      .attr("fill", (d) => d.color)
      .attr("stroke", isDark ? "#0f1117" : "#f8f7f4")
      .attr("stroke-width", (d) => (d.type === "category" ? 2 : 1.5))
      .attr("fill-opacity", (d) => (d.type === "category" ? 0.9 : 0.8));

    // Category labels
    node
      .filter((d) => d.type === "category")
      .append("text")
      .text((d) => d.label)
      .attr("y", (d) => d.radius + 14)
      .attr("text-anchor", "middle")
      .attr("fill", isDark ? "#d1d5db" : "#1a1a2e")
      .attr("font-family", "'Inter', system-ui, sans-serif")
      .attr("font-size", "11px")
      .attr("font-weight", "600")
      .attr("paint-order", "stroke")
      .attr("stroke", isDark ? "#0f1117" : "#f8f7f4")
      .attr("stroke-width", 3)
      .attr("stroke-linejoin", "round");

    // Count on category nodes
    node
      .filter((d) => d.type === "category" && !!d.paperCount)
      .append("text")
      .text((d) => d.paperCount || "")
      .attr("y", 4)
      .attr("text-anchor", "middle")
      .attr("fill", "#ffffff")
      .attr("font-size", "10px")
      .attr("font-weight", "700");

    // Interactions
    node
      .on("mouseenter", (event, d) => {
        setHoveredNode(d);
        const [x, y] = d3.pointer(event, containerRef.current);
        setTooltipPos({ x, y });

        link
          .attr("stroke-opacity", (l) => {
            const sId = typeof l.source === "object" ? (l.source as GraphNode).id : l.source;
            const tId = typeof l.target === "object" ? (l.target as GraphNode).id : l.target;
            return sId === d.id || tId === d.id ? 1 : 0.05;
          })
          .attr("stroke-width", (l) => {
            const sId = typeof l.source === "object" ? (l.source as GraphNode).id : l.source;
            const tId = typeof l.target === "object" ? (l.target as GraphNode).id : l.target;
            return sId === d.id || tId === d.id ? 2.5 : 1;
          });
      })
      .on("mousemove", (event) => {
        const [x, y] = d3.pointer(event, containerRef.current);
        setTooltipPos({ x, y });
      })
      .on("mouseleave", () => {
        setHoveredNode(null);
        link.attr("stroke-opacity", 1).attr("opacity", isDark ? 0.5 : 0.8).attr("stroke-width", (d) => (d.weight ? Math.min(3.5, 1.5 + d.weight * 0.6) : 1.5));
      })
      .on("click", (_event, d) => {
        if (d.type === "paper" && d.paperRef) {
          onSelectPaper(d.paperRef);
        } else if (d.type === "category") {
          setSelectedCategory(d.label === selectedCategory ? null : d.label);
        }
      });

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as GraphNode).x ?? 0)
        .attr("y1", (d) => (d.source as GraphNode).y ?? 0)
        .attr("x2", (d) => (d.target as GraphNode).x ?? 0)
        .attr("y2", (d) => (d.target as GraphNode).y ?? 0);

      node.attr("transform", (d) => `translate(${d.x ?? 0}, ${d.y ?? 0})`);
    });

    return () => {
      simulation.stop();
    };
  }, [nodes, links, chargeStrength, linkDistance, viewMode, isDark]);

  useEffect(() => {
    if (!simulationRef.current) return;
    if (isPlaying) {
      simulationRef.current.alphaTarget(0.1).restart();
    } else {
      simulationRef.current.stop();
    }
  }, [isPlaying]);

  const handleZoomIn = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1.3);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 0.75);
    }
  };

  const handleResetZoom = () => {
    if (svgRef.current && zoomRef.current && containerRef.current) {
      const width = containerRef.current.clientWidth || 900;
      const height = containerRef.current.clientHeight || 650;
      d3.select(svgRef.current)
        .transition()
        .duration(400)
        .call(
          zoomRef.current.transform,
          d3.zoomIdentity.translate(width / 2, height / 2).scale(0.85)
        );
    }
  };

  return (
    <div className="relative w-full h-[720px] rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#141520] overflow-hidden flex flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 bg-gray-50 dark:bg-[#1a1b2e] border-b border-gray-200 dark:border-gray-800 z-10">
        <div className="flex items-center gap-2">
          {/* Mode toggle */}
          <div className="flex items-center bg-white dark:bg-[#0f1117] rounded-md p-0.5 border border-gray-200 dark:border-gray-700">
            <button
              id="graph-mode-bipartite-btn"
              onClick={() => setViewMode("bipartite")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                viewMode === "bipartite"
                  ? "bg-[#1a1a2e] dark:bg-gray-700 text-white"
                  : "text-[#6b7280] hover:text-[#1a1a2e] dark:hover:text-gray-200"
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>Categories</span>
            </button>
            <button
              id="graph-mode-similarity-btn"
              onClick={() => setViewMode("similarity")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                viewMode === "similarity"
                  ? "bg-[#1a1a2e] dark:bg-gray-700 text-white"
                  : "text-[#6b7280] hover:text-[#1a1a2e] dark:hover:text-gray-200"
              }`}
            >
              <GitFork className="w-3 h-3" />
              <span>Similarity</span>
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 pr-3 py-1 w-40 lg:w-52 bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-gray-700 rounded-md text-xs text-[#1a1a2e] dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:block text-xs text-[#6b7280] tabular-nums">
            {nodes.length} nodes · {links.length} edges
          </span>

          <div className="flex items-center bg-white dark:bg-[#0f1117] rounded-md border border-gray-200 dark:border-gray-700 p-0.5">
            <button id="graph-zoom-in-btn" onClick={handleZoomIn} className="p-1 text-[#6b7280] hover:text-[#1a1a2e] dark:hover:text-gray-200 rounded cursor-pointer" title="Zoom in">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button id="graph-zoom-out-btn" onClick={handleZoomOut} className="p-1 text-[#6b7280] hover:text-[#1a1a2e] dark:hover:text-gray-200 rounded cursor-pointer" title="Zoom out">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button id="graph-reset-zoom-btn" onClick={handleResetZoom} className="p-1 text-[#6b7280] hover:text-[#1a1a2e] dark:hover:text-gray-200 rounded cursor-pointer" title="Fit to view">
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              id="graph-toggle-play-btn"
              onClick={() => setIsPlaying(!isPlaying)}
              className={`p-1 rounded transition-colors cursor-pointer ${
                isPlaying
                  ? "text-[#6b7280] hover:text-[#1a1a2e] dark:hover:text-gray-200"
                  : "text-amber-600 bg-amber-50 dark:bg-amber-900/30"
              }`}
              title={isPlaying ? "Pause simulation" : "Resume simulation"}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Graph canvas */}
      <div ref={containerRef} className="relative flex-1 w-full h-full overflow-hidden bg-[#fafaf8] dark:bg-[#0d0e18]">
        <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Tooltip */}
        {hoveredNode && (
          <div
            className="absolute pointer-events-none z-30 max-w-xs p-3 bg-white/95 dark:bg-gray-900/95 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg backdrop-blur-sm text-xs"
            style={{
              left: Math.min(tooltipPos.x + 15, (containerRef.current?.clientWidth || 800) - 300),
              top: Math.max(10, Math.min(tooltipPos.y + 15, (containerRef.current?.clientHeight || 600) - 160)),
            }}
          >
            {hoveredNode.type === "paper" && hoveredNode.paperRef ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-medium border"
                    style={{
                      borderColor: `${getCategoryColor(hoveredNode.paperRef.primaryCategory)}30`,
                      backgroundColor: `${getCategoryColor(hoveredNode.paperRef.primaryCategory)}10`,
                      color: getCategoryColor(hoveredNode.paperRef.primaryCategory),
                    }}
                  >
                    {hoveredNode.paperRef.primaryCategory}
                  </span>
                  <span className="text-[10px] text-[#6b7280]">{hoveredNode.paperRef.date}</span>
                </div>
                <div className="font-medium text-[#1a1a2e] dark:text-gray-100 line-clamp-2 leading-snug">
                  {hoveredNode.paperRef.title}
                </div>
                <div className="text-[11px] text-[#e63946] font-medium line-clamp-1">
                  {hoveredNode.paperRef.method}
                </div>
                <div className="text-[11px] text-[#6b7280] line-clamp-2 leading-relaxed">
                  {hoveredNode.paperRef.abstract}
                </div>
                <div className="pt-1 border-t border-gray-100 dark:border-gray-700 text-[10px] text-[#6b7280]">
                  Click to inspect
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: hoveredNode.color }} />
                  <span className="font-medium text-[#1a1a2e] dark:text-gray-100">{hoveredNode.label}</span>
                </div>
                <p className="text-[#6b7280]">
                  {hoveredNode.paperCount} papers in this category
                </p>
              </div>
            )}
          </div>
        )}

        {/* Topic filter bar */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-white/95 dark:bg-gray-900/95 border border-gray-200 dark:border-gray-700 backdrop-blur-sm shadow-sm">
            <Filter className="w-3 h-3 text-[#6b7280] shrink-0" />
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors shrink-0 cursor-pointer ${
                selectedCategory === null
                  ? "bg-[#1a1a2e] dark:bg-gray-700 text-white"
                  : "text-[#6b7280] hover:text-[#1a1a2e] dark:hover:text-gray-200"
              }`}
            >
              All ({papers.length})
            </button>
            {allCategories.slice(0, 8).map((cat) => (
              <button
                key={cat.name}
                onClick={() => setSelectedCategory(selectedCategory === cat.name ? null : cat.name)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors shrink-0 cursor-pointer ${
                  selectedCategory === cat.name
                    ? "bg-[#e63946] text-white"
                    : "text-[#6b7280] hover:text-[#1a1a2e] dark:hover:text-gray-200"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: getCategoryColor(cat.name) }} />
                <span>{cat.name}</span>
                <span className="opacity-60">{cat.count}</span>
              </button>
            ))}
          </div>

          {selectedCategory && (
            <button
              onClick={() => onExploreTopic(selectedCategory)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#e63946] hover:bg-[#c1292e] text-white text-[11px] font-medium shrink-0 transition-colors active:scale-[0.97] cursor-pointer"
            >
              Explore {selectedCategory} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
