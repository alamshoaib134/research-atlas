import { useState, useEffect, useMemo } from "react";
import { usePapers } from "./hooks/useDatabase";
import { useTheme } from "./hooks/useTheme";
import { Paper } from "./types";
import NetworkGraph from "./components/NetworkGraph";
import TopicDevelopments from "./components/TopicDevelopments";
import PaperTable from "./components/PaperTable";
import PaperDrawer from "./components/PaperDrawer";
import ImportModal from "./components/ImportModal";
import { 
  Network, 
  TrendingUp, 
  Library, 
  Upload, 
  Loader2,
  Moon,
  Sun,
  MessageSquare
} from "lucide-react";
import RagQA from "./components/RagQA";

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const {
    papers,
    loading,
    error,
    dbAvailable,
    dbStats,
    refetch,
    setPapers,
  } = usePapers();

  const [activeTab, setActiveTab] = useState<"graph" | "developments" | "library" | "qa">("graph");
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Auto-detect first topic from real data
  const firstAvailableTopic = useMemo(() => {
    if (papers.length === 0) return "Artificial Intelligence";
    const counts = new Map<string, number>();
    papers.forEach((p) => {
      p.categories.forEach((c) => {
        counts.set(c, (counts.get(c) || 0) + 1);
      });
    });
    let maxTopic = papers[0]?.primaryCategory || papers[0]?.categories[0] || "Artificial Intelligence";
    let maxCount = 0;
    counts.forEach((count, topic) => {
      if (count > maxCount) {
        maxCount = count;
        maxTopic = topic;
      }
    });
    return maxTopic;
  }, [papers]);

  useEffect(() => {
    if (!selectedTopic && firstAvailableTopic) {
      setSelectedTopic(firstAvailableTopic);
    }
  }, [firstAvailableTopic, selectedTopic]);

  const handleImportPapers = (newPapers: Paper[]) => {
    setPapers(newPapers);
    if (newPapers[0]?.categories?.[0]) {
      setSelectedTopic(newPapers[0].categories[0]);
    }
  };

  const handleResetPapers = () => {
    localStorage.removeItem("arxiv_custom_papers");
    refetch();
    setSelectedTopic("");
  };

  const handleExploreTopic = (topic: string) => {
    setSelectedTopic(topic);
    setActiveTab("developments");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const tabs = [
    { id: "graph" as const, label: "Graph", icon: Network },
    { id: "developments" as const, label: "Evolution", icon: TrendingUp },
    { id: "qa" as const, label: "Q&A", icon: MessageSquare },
    { id: "library" as const, label: "Archive", icon: Library },
  ];

  return (
    <div className="min-h-screen bg-[#f8f7f4] text-[#1a1a2e] dark:bg-[#0f1117] dark:text-gray-200 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#f8f7f4]/95 dark:bg-[#0f1117]/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 px-4 lg:px-6 h-12 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#1d3557] dark:bg-[#e63946] flex items-center justify-center">
              <Network className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-[#1a1a2e] dark:text-gray-100 tracking-tight">
              Research Atlas
            </span>
          </div>

          {/* Tabs */}
          <nav className="hidden sm:flex items-center gap-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                id={`nav-tab-${tab.id}-btn`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-[#e63946] text-white"
                    : "text-[#6b7280] hover:text-[#1a1a2e] dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#6b7280]" />
          ) : (
            <span className="text-xs text-[#6b7280] tabular-nums">
              <span className="font-semibold text-[#1a1a2e] dark:text-gray-200">{papers.length}</span> papers
              {dbAvailable && <span className="ml-1.5 text-[#2d6a4f]">· live</span>}
            </span>
          )}

          <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />

          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-md text-[#6b7280] hover:text-[#1a1a2e] dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>

          <button
            id="header-import-papers-btn"
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#1a1a2e] dark:bg-gray-800 hover:bg-[#2a2a4e] dark:hover:bg-gray-700 text-white text-xs font-medium transition-colors active:scale-[0.97] cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Import</span>
          </button>
        </div>
      </header>

      {/* Mobile tab bar */}
      <div className="sm:hidden flex items-center gap-0.5 px-4 py-2 border-b border-gray-200 dark:border-gray-800 bg-[#f8f7f4] dark:bg-[#0f1117]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === tab.id
                ? "bg-[#e63946] text-white"
                : "text-[#6b7280] hover:text-[#1a1a2e] dark:hover:text-gray-200"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && papers.length <= 3 && (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3 text-[#6b7280]">
            <Loader2 className="w-6 h-6 animate-spin text-[#e63946]" />
            <div className="text-sm">Loading papers…</div>
            {dbStats && (
              <div className="text-xs text-[#6b7280]">
                {dbStats.papers} papers · {dbStats.claims} claims · {dbStats.explanations} explanations
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main content */}
      {(!loading || papers.length > 3) && (
        <main className="flex-1 w-full max-w-full mx-auto p-4 lg:px-6 lg:py-5">
          {activeTab === "graph" && (
            <div className="space-y-5">
              {/* Graph hero — first thing you see */}
              <NetworkGraph
                papers={papers}
                onSelectPaper={(paper) => setSelectedPaper(paper)}
                onExploreTopic={handleExploreTopic}
              />

              {/* About section — below the graph */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2 p-5 rounded-lg bg-white dark:bg-[#141520] border border-gray-200 dark:border-gray-800">
                  <h2 className="text-lg font-semibold text-[#1a1a2e] dark:text-gray-100 tracking-tight">
                    What is Research Atlas?
                  </h2>
                  <p className="text-sm text-[#6b7280] mt-2 leading-relaxed max-w-xl">
                    Research Atlas helps you navigate the landscape of arXiv papers. It maps <span className="font-medium text-[#1a1a2e] dark:text-gray-200">{papers.length} papers</span> into 
                    an interactive network where you can see how research topics like KV Cache, Attention Optimization, Speculative Decoding, 
                    and Vision Transformers overlap and connect. Each node in the graph above is either a paper or a topic category — 
                    edges show which papers belong to which topics.
                  </p>
                  <p className="text-sm text-[#6b7280] mt-2 leading-relaxed max-w-xl">
                    Click any paper node to inspect its method, authors, and key claims. Switch to the <span className="font-medium text-[#1a1a2e] dark:text-gray-200">Evolution</span> tab 
                    to trace how methods in a topic have progressed over time — which technique improved upon which, and by how much. 
                    The <span className="font-medium text-[#1a1a2e] dark:text-gray-200">Archive</span> tab gives you a searchable, sortable table of every paper in the database.
                  </p>
                  {selectedTopic && (
                    <button
                      onClick={() => handleExploreTopic(selectedTopic)}
                      className="mt-3 text-sm text-[#e63946] hover:text-[#c1292e] font-medium cursor-pointer"
                    >
                      Explore "{selectedTopic}" method evolution →
                    </button>
                  )}
                </div>

                <div className="p-5 rounded-lg bg-white dark:bg-[#141520] border border-gray-200 dark:border-gray-800 space-y-4">
                  <h3 className="text-sm font-semibold text-[#1a1a2e] dark:text-gray-100">How to use the graph</h3>
                  <div className="space-y-3 text-xs text-[#6b7280]">
                    <div className="flex items-start gap-2.5">
                      <span className="w-3.5 h-3.5 rounded-full bg-[#1d3557] shrink-0 mt-0.5" />
                      <span><span className="font-medium text-[#1a1a2e] dark:text-gray-200">Large nodes</span> are topic categories. Click to filter the graph to that topic.</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#6b7280] shrink-0 mt-1" />
                      <span><span className="font-medium text-[#1a1a2e] dark:text-gray-200">Small nodes</span> are individual papers. Click to open the paper inspector with full details.</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="w-3.5 h-0.5 bg-gray-400 dark:bg-gray-500 shrink-0 mt-2 rounded" />
                      <span><span className="font-medium text-[#1a1a2e] dark:text-gray-200">Solid edges</span> connect papers to the categories they belong to.</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="w-3.5 h-0.5 border-t-[1.5px] border-dashed border-[#e63946] shrink-0 mt-2" />
                      <span><span className="font-medium text-[#1a1a2e] dark:text-gray-200">Dashed edges</span> link papers that share multiple categories (similarity view).</span>
                    </div>
                    <p className="text-[11px] text-[#9ca3af] pt-1">
                      Drag nodes to rearrange. Scroll to zoom in/out. Use the toolbar to search, filter by topic, or switch between category clusters and paper similarity views.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "developments" && (
            <TopicDevelopments
              papers={papers}
              selectedTopic={selectedTopic}
              onSelectTopic={setSelectedTopic}
              onSelectPaper={(paper) => setSelectedPaper(paper)}
            />
          )}

          {activeTab === "qa" && (
            <div className="max-w-4xl mx-auto mt-4">
              <RagQA papers={papers} onSelectPaper={(p) => setSelectedPaper(p as Paper)} />
            </div>
          )}

          {activeTab === "library" && (
            <PaperTable
              papers={papers}
              onSelectPaper={(paper) => setSelectedPaper(paper)}
              onExploreTopic={handleExploreTopic}
            />
          )}
        </main>
      )}

      {/* Paper drawer */}
      <PaperDrawer
        paper={selectedPaper}
        onClose={() => setSelectedPaper(null)}
        onExploreTopic={handleExploreTopic}
        allPapers={papers}
        onSelectPaper={(p) => setSelectedPaper(p)}
      />

      {/* Import modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImportPapers}
        onReset={handleResetPapers}
        currentPapers={papers}
        onLoadFromDb={refetch}
        dbAvailable={dbAvailable}
        dbStats={dbStats}
      />
    </div>
  );
}
