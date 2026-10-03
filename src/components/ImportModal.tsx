import { useState } from "react";
import { Paper } from "../types";
import { 
  Upload, 
  Download, 
  RotateCcw, 
  FileCode, 
  Globe, 
  Check, 
  AlertCircle, 
  X,
  Database,
  Loader2
} from "lucide-react";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (newPapers: Paper[]) => void;
  onReset: () => void;
  currentPapers: Paper[];
  onLoadFromDb?: () => void;
  dbAvailable?: boolean;
  dbStats?: { papers: number; claims: number; explanations: number } | null;
}

export default function ImportModal({
  isOpen,
  onClose,
  onImport,
  onReset,
  currentPapers,
  onLoadFromDb,
  dbAvailable,
  dbStats,
}: ImportModalProps) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<"database" | "upload" | "paste" | "arxiv">("database");
  const [pastedText, setPastedText] = useState("");
  const [arxivQuery, setArxivQuery] = useState("KV Cache");
  const [arxivCount, setArxivCount] = useState(25);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const normalizePapers = (rawList: any[]): Paper[] => {
    return rawList.map((item, idx) => {
      const title = item.title || item.name || `Untitled Paper ${idx + 1}`;
      const authors = Array.isArray(item.authors)
        ? item.authors
        : typeof item.authors === "string"
        ? item.authors.split(",").map((a: string) => a.trim())
        : ["Unknown Authors"];

      let categories: string[] = [];
      if (Array.isArray(item.categories)) {
        categories = item.categories;
      } else if (typeof item.categories === "string") {
        categories = item.categories.split(",").map((c: string) => c.trim());
      } else if (Array.isArray(item.tags)) {
        categories = item.tags;
      } else {
        categories = ["Artificial Intelligence", "Machine Learning"];
      }

      const date = item.date || item.published || item.year || new Date().toISOString().split("T")[0];
      const method = item.method || item.technique || `Method ${idx + 1}: ${categories[0]} formulation`;
      const improvesUpon = item.improvesUpon || item.bottleneckSolves || undefined;
      const keyInnovation = item.keyInnovation || item.contribution || undefined;
      const metricsOrGains = item.metricsOrGains || item.gains || undefined;

      return {
        id: item.id || `user-p-${Date.now()}-${idx}`,
        arxivId: item.arxivId || item.id || undefined,
        title,
        authors,
        date: String(date).slice(0, 10),
        categories,
        primaryCategory: item.primaryCategory || categories[0] || "Artificial Intelligence",
        abstract: item.abstract || item.summary || "No abstract provided.",
        method,
        improvesUpon,
        keyInnovation,
        metricsOrGains,
        citationsCount: Number(item.citationsCount || item.citations || 0),
        url: item.url || (item.arxivId ? `https://arxiv.org/abs/${item.arxivId}` : undefined),
      };
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (file.name.endsWith(".json")) {
          const parsed = JSON.parse(text);
          const paperArray = Array.isArray(parsed) ? parsed : parsed.papers || [];
          if (!Array.isArray(paperArray) || paperArray.length === 0) {
            throw new Error("JSON file must contain an array of papers.");
          }
          const normalized = normalizePapers(paperArray);
          onImport(normalized);
          setStatusMessage({ type: "success", text: `Loaded ${normalized.length} papers from file.` });
        } else if (file.name.endsWith(".csv")) {
          const lines = text.split("\n").filter((l) => l.trim().length > 0);
          const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
          const titleIdx = headers.findIndex((h) => h.includes("title"));
          const dateIdx = headers.findIndex((h) => h.includes("date") || h.includes("year"));
          const abstractIdx = headers.findIndex((h) => h.includes("abstract") || h.includes("summary"));
          const catIdx = headers.findIndex((h) => h.includes("cat") || h.includes("tag"));

          const parsedList: any[] = [];
          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
            if (cols.length > 0 && cols[titleIdx !== -1 ? titleIdx : 0]) {
              parsedList.push({
                title: cols[titleIdx !== -1 ? titleIdx : 0],
                date: dateIdx !== -1 ? cols[dateIdx] : "2024-01-01",
                abstract: abstractIdx !== -1 ? cols[abstractIdx] : "",
                categories: catIdx !== -1 ? cols[catIdx].split(";") : ["AI"],
              });
            }
          }
          const normalized = normalizePapers(parsedList);
          onImport(normalized);
          setStatusMessage({ type: "success", text: `Imported ${normalized.length} papers from CSV.` });
        }
      } catch (err: any) {
        setStatusMessage({ type: "error", text: `Failed to parse file: ${err.message}` });
      }
    };
    reader.readAsText(file);
  };

  const handlePasteSubmit = () => {
    try {
      const parsed = JSON.parse(pastedText);
      const paperArray = Array.isArray(parsed) ? parsed : parsed.papers || [];
      if (!Array.isArray(paperArray) || paperArray.length === 0) {
        throw new Error("Pasted JSON must be an array of papers or have a 'papers' key.");
      }
      const normalized = normalizePapers(paperArray);
      onImport(normalized);
      setStatusMessage({ type: "success", text: `Imported ${normalized.length} papers.` });
    } catch (err: any) {
      setStatusMessage({ type: "error", text: `Invalid JSON: ${err.message}` });
    }
  };

  const handleFetchArxiv = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      // Call arXiv API directly (public API, supports CORS)
      const maxResults = Math.min(arxivCount, 100);
      const arxivUrl = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(arxivQuery)}&start=0&max_results=${maxResults}&sortBy=submittedDate&sortOrder=descending`;
      const res = await fetch(arxivUrl);
      if (!res.ok) throw new Error("arXiv API request failed");
      const xml = await res.text();
      const entries = xml.split("<entry>");
      const fetched: any[] = [];

      for (let i = 1; i < entries.length; i++) {
        const entry = entries[i];
        const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
        const summaryMatch = entry.match(/<summary>([\s\S]*?)<\/summary>/);
        const publishedMatch = entry.match(/<published>([\s\S]*?)<\/published>/);
        const idMatch = entry.match(/<id>([\s\S]*?)<\/id>/);

        const title = titleMatch ? titleMatch[1].replace(/\n/g, " ").trim() : `arXiv Paper ${i}`;
        const abstract = summaryMatch ? summaryMatch[1].replace(/\n/g, " ").trim() : "";
        const published = publishedMatch ? publishedMatch[1].slice(0, 10) : new Date().toISOString().split("T")[0];
        const fullId = idMatch ? idMatch[1].trim() : "";
        const arxivNum = fullId.split("/abs/")[1] || fullId.split("/").pop();

        fetched.push({
          title,
          abstract,
          date: published,
          arxivId: arxivNum,
          categories: [arxivQuery.trim() || "AI", "Large Language Models", "Machine Learning"],
          primaryCategory: arxivQuery.trim() || "AI",
          method: `Method ${i}: Novel ${arxivQuery} architecture`,
          improvesUpon: `Enhances throughput and context handling compared to previous standard models.`,
          url: fullId,
        });
      }

      if (fetched.length === 0) {
        throw new Error("No papers returned from arXiv for this query.");
      }

      const normalized = normalizePapers(fetched);
      onImport(normalized);
      setStatusMessage({ type: "success", text: `Fetched ${normalized.length} papers from arXiv.` });
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to fetch from arXiv." });
    } finally {
      setLoading(false);
    }
  };

  const handleLoadFromDb = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      // Try static JSON first (Vercel), then API fallback (local dev)
      let res = await fetch("/data/papers.json");
      if (!res.ok) {
        res = await fetch("/api/papers");
      }
      if (!res.ok) throw new Error("Failed to load papers");
      const papers = await res.json();
      if (!Array.isArray(papers) || papers.length === 0) {
        throw new Error("No papers found.");
      }
      onImport(papers);
      setStatusMessage({ type: "success", text: `Loaded ${papers.length} papers.` });
      if (onLoadFromDb) onLoadFromDb();
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to load from database." });
    } finally {
      setLoading(false);
    }
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentPapers, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `arxiv-papers-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const tabs = [
    { id: "database" as const, label: "Database", icon: Database },
    { id: "upload" as const, label: "Upload", icon: Upload },
    { id: "paste" as const, label: "Paste JSON", icon: FileCode },
    { id: "arxiv" as const, label: "arXiv API", icon: Globe },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-lg bg-white dark:bg-[#141520] border border-gray-200 dark:border-gray-800 shadow-2xl p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h3 className="text-sm font-semibold text-[#1a1a2e] dark:text-gray-100">Import papers</h3>
            <p className="text-xs text-[#6b7280] mt-0.5">
              Current archive: <span className="font-medium text-[#e63946] tabular-nums">{currentPapers.length}</span> papers
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[#6b7280] hover:text-[#1a1a2e] dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 pb-2 border-b border-gray-100 dark:border-gray-800">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === tab.id
                  ? "bg-[#e63946] text-white"
                  : "text-[#6b7280] hover:text-[#1a1a2e] dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <tab.icon className="w-3 h-3" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "database" && (
          <div className="space-y-3">
            <p className="text-xs text-[#6b7280]">
              Load all papers from <span className="font-mono font-medium text-[#1a1a2e] dark:text-gray-200">papers.db</span>, including AI-enriched claims, methods, and explanations.
            </p>

            {dbStats && (
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Papers", value: dbStats.papers, color: "#e63946" },
                  { label: "Claims", value: dbStats.claims, color: "#2d6a4f" },
                  { label: "Explanations", value: dbStats.explanations, color: "#1d3557" },
                ].map((s) => (
                  <div key={s.label} className="p-2.5 rounded-md bg-gray-50 dark:bg-[#0f1117] border border-gray-100 dark:border-gray-800 text-center">
                    <div className="text-base font-semibold tabular-nums" style={{ color: s.color }}>{s.value}</div>
                    <div className="text-[10px] text-[#6b7280]">{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="p-3 rounded-md bg-[#2d6a4f]/5 dark:bg-emerald-900/10 border border-[#2d6a4f]/15 dark:border-emerald-800/30 text-xs text-[#2d6a4f] dark:text-emerald-400 space-y-1">
              <div className="font-medium flex items-center gap-1.5">
                <Database className="w-3 h-3" />
                {dbAvailable ? "Connected" : "Checking…"}
              </div>
              <p className="text-[#6b7280]">
                Includes arXiv metadata, AI keywords, summaries, GitHub links, and method claims.
              </p>
            </div>

            <button
              onClick={handleLoadFromDb}
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-md bg-[#e63946] hover:bg-[#c1292e] disabled:opacity-40 text-white text-sm font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading…</span>
                </>
              ) : (
                <>
                  <Database className="w-4 h-4" />
                  <span>Load from database</span>
                </>
              )}
            </button>
          </div>
        )}

        {activeTab === "upload" && (
          <div>
            <label className="border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 rounded-lg p-8 flex flex-col items-center justify-center gap-2 cursor-pointer bg-gray-50 dark:bg-[#0f1117] hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors">
              <Upload className="w-6 h-6 text-[#e63946]" />
              <span className="text-sm font-medium text-[#1a1a2e] dark:text-gray-200">
                Drop a file or click to browse
              </span>
              <p className="text-xs text-[#6b7280]">
                JSON or CSV with title, abstract, date, categories
              </p>
              <input
                type="file"
                accept=".json,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        )}

        {activeTab === "paste" && (
          <div className="space-y-2.5">
            <p className="text-xs text-[#6b7280]">
              Paste a JSON array of papers:
            </p>
            <textarea
              rows={6}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder='[{"title": "...", "categories": ["AI"], "method": "..."}]'
              className="w-full p-3 bg-gray-50 dark:bg-[#0f1117] border border-gray-200 dark:border-gray-700 rounded-md text-xs font-mono text-[#1a1a2e] dark:text-gray-200 focus:outline-none focus:border-gray-400 resize-none"
            />
            <button
              onClick={handlePasteSubmit}
              disabled={!pastedText.trim()}
              className="py-2 px-4 rounded-md bg-[#e63946] hover:bg-[#c1292e] disabled:opacity-40 text-white text-xs font-medium cursor-pointer transition-colors"
            >
              Parse and load
            </button>
          </div>
        )}

        {activeTab === "arxiv" && (
          <div className="space-y-3">
            <p className="text-xs text-[#6b7280]">
              Query the arXiv API to pull recent papers:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-medium text-[#6b7280]">Topic</label>
                <input
                  type="text"
                  value={arxivQuery}
                  onChange={(e) => setArxivQuery(e.target.value)}
                  placeholder="e.g. KV Cache, Vision Transformer"
                  className="w-full p-2 bg-gray-50 dark:bg-[#0f1117] border border-gray-200 dark:border-gray-700 rounded-md text-xs text-[#1a1a2e] dark:text-gray-200 focus:outline-none focus:border-gray-400"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#6b7280]">Max</label>
                <input
                  type="number"
                  min={5}
                  max={100}
                  value={arxivCount}
                  onChange={(e) => setArxivCount(Number(e.target.value))}
                  className="w-full p-2 bg-gray-50 dark:bg-[#0f1117] border border-gray-200 dark:border-gray-700 rounded-md text-xs font-mono text-[#1a1a2e] dark:text-gray-200 focus:outline-none focus:border-gray-400"
                />
              </div>
            </div>
            <button
              onClick={handleFetchArxiv}
              disabled={loading || !arxivQuery.trim()}
              className="py-2 px-4 rounded-md bg-[#e63946] hover:bg-[#c1292e] disabled:opacity-40 text-white text-xs font-medium flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{loading ? "Querying…" : `Fetch "${arxivQuery}"`}</span>
            </button>
          </div>
        )}

        {/* Status */}
        {statusMessage && (
          <div
            className={`p-2.5 rounded-md text-xs flex items-center gap-2 ${
              statusMessage.type === "success"
                ? "bg-[#2d6a4f]/5 border border-[#2d6a4f]/15 text-[#2d6a4f]"
                : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-400"
            }`}
          >
            {statusMessage.type === "success" ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs">
          <button
            onClick={() => {
              onReset();
              setStatusMessage({ type: "success", text: "Reloading from database…" });
            }}
            className="flex items-center gap-1.5 text-[#6b7280] hover:text-[#1a1a2e] dark:hover:text-gray-200 font-medium transition-colors py-1 px-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportJSON}
              className="flex items-center gap-1.5 py-1 px-2.5 rounded-md bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-[#6b7280] border border-gray-200 dark:border-gray-700 font-medium transition-colors cursor-pointer"
            >
              <Download className="w-3 h-3" />
              <span>Export JSON</span>
            </button>
            <button
              onClick={onClose}
              className="py-1 px-3 rounded-md bg-[#1a1a2e] dark:bg-gray-800 hover:bg-[#2a2a4e] dark:hover:bg-gray-700 text-white font-medium cursor-pointer transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
