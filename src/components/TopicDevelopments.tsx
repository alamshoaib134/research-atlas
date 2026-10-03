import { useState, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { Paper, TopicNewsItem } from "../types";
import { getCategoryColor } from "../utils/graphUtils";
import { 
  ArrowRight,
  ExternalLink, 
  TrendingUp, 
  CheckCircle2, 
  Newspaper, 
  RefreshCw, 
  GitCompare, 
  BookOpen, 
  Zap,
  ChevronDown,
  ChevronUp
} from "lucide-react";

interface TopicDevelopmentsProps {
  papers: Paper[];
  selectedTopic: string;
  onSelectTopic: (topic: string) => void;
  onSelectPaper: (paper: Paper) => void;
}

export default function TopicDevelopments({
  papers,
  selectedTopic,
  onSelectTopic,
  onSelectPaper,
}: TopicDevelopmentsProps) {
  const topicPapers = useMemo(() => {
    return papers
      .filter((p) => p.categories.includes(selectedTopic) || p.primaryCategory === selectedTopic)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [papers, selectedTopic]);

  const availableTopics = useMemo(() => {
    const counts = new Map<string, number>();
    papers.forEach((p) => {
      p.categories.forEach((c) => {
        counts.set(c, (counts.get(c) || 0) + 1);
      });
    });
    return Array.from(counts.entries())
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1]);
  }, [papers]);

  const [news, setNews] = useState<TopicNewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);

  const [aiSynthesis, setAiSynthesis] = useState<string | null>(null);
  const [synthesisLoading, setSynthesisLoading] = useState(false);
  const [showSynthesis, setShowSynthesis] = useState(false);

  const [comparePaperA, setComparePaperA] = useState<Paper | null>(null);
  const [comparePaperB, setComparePaperB] = useState<Paper | null>(null);
  const [showCompareModal, setShowCompareModal] = useState(false);

  const [expandedAbstracts, setExpandedAbstracts] = useState<Record<string, boolean>>({});

  const toggleAbstract = (id: string) => {
    setExpandedAbstracts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    if (!selectedTopic) return;
    let isMounted = true;
    setNewsLoading(true);
    setNewsError(null);

    fetch("/api/topic-news", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: selectedTopic }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) {
          if (data.news && Array.isArray(data.news)) {
            setNews(data.news);
          } else {
            setNews([]);
          }
          setNewsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error("Failed to load news:", err);
          setNewsError("Unable to fetch latest news.");
          setNewsLoading(false);
        }
      });

    setAiSynthesis(null);
    setShowSynthesis(false);

    return () => {
      isMounted = false;
    };
  }, [selectedTopic]);

  const handleGenerateSynthesis = async () => {
    if (topicPapers.length === 0) return;
    setSynthesisLoading(true);
    setShowSynthesis(true);

    try {
      const response = await fetch("/api/analyze-topic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: selectedTopic,
          papers: topicPapers.slice(0, 15),
        }),
      });

      const data = await response.json();
      if (data.analysis) {
        setAiSynthesis(data.analysis);
      } else if (data.error) {
        setAiSynthesis(`Could not generate synthesis: ${data.error}`);
      }
    } catch (err: any) {
      setAiSynthesis(`Analysis failed: ${err.message || "Unknown error"}`);
    } finally {
      setSynthesisLoading(false);
    }
  };

  const openComparison = (paper1: Paper, paper2?: Paper) => {
    setComparePaperA(paper1);
    if (paper2) {
      setComparePaperB(paper2);
    } else {
      const idx = topicPapers.findIndex((p) => p.id === paper1.id);
      if (idx > 0) {
        setComparePaperB(topicPapers[idx - 1]);
      } else if (idx < topicPapers.length - 1) {
        setComparePaperB(topicPapers[idx + 1]);
      } else {
        setComparePaperB(null);
      }
    }
    setShowCompareModal(true);
  };

  const topicColor = getCategoryColor(selectedTopic);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="p-5 rounded-lg bg-white dark:bg-[#141520] border border-gray-200 dark:border-gray-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: topicColor }} />
              <h2 className="text-lg font-semibold text-[#1a1a2e] dark:text-gray-100 tracking-tight">
                Method evolution
              </h2>
            </div>
            <p className="text-xs text-[#6b7280] mt-1 max-w-lg">
              How methods in this topic have progressed — what each paper improved and why.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              id="topic-select-dropdown"
              value={selectedTopic}
              onChange={(e) => onSelectTopic(e.target.value)}
              className="px-3 py-1.5 bg-gray-50 dark:bg-[#0f1117] border border-gray-200 dark:border-gray-700 rounded-md text-xs font-medium text-[#1a1a2e] dark:text-gray-200 focus:outline-none focus:border-gray-400 cursor-pointer"
            >
              {availableTopics.map(([tName, count]) => (
                <option key={tName} value={tName}>
                  {tName} ({count})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Topic chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-3 border-t border-gray-100 dark:border-gray-800">
          {availableTopics.slice(0, 12).map(([topicName, count]) => (
            <button
              key={topicName}
              onClick={() => onSelectTopic(topicName)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors shrink-0 cursor-pointer ${
                selectedTopic === topicName
                  ? "bg-[#e63946] text-white"
                  : "bg-gray-50 dark:bg-gray-800 text-[#6b7280] hover:text-[#1a1a2e] dark:hover:text-gray-200 border border-gray-200 dark:border-gray-700"
              }`}
            >
              {topicName} ({count})
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-md bg-gray-50 dark:bg-[#0f1117] border border-gray-100 dark:border-gray-800">
            <div className="text-xs text-[#6b7280]">Papers</div>
            <div className="text-xl font-semibold text-[#1a1a2e] dark:text-gray-100 mt-0.5 tabular-nums">{topicPapers.length}</div>
          </div>
          <div className="p-3 rounded-md bg-gray-50 dark:bg-[#0f1117] border border-gray-100 dark:border-gray-800">
            <div className="text-xs text-[#6b7280]">Time range</div>
            <div className="text-xs font-medium text-[#1a1a2e] dark:text-gray-200 mt-1.5 tabular-nums">
              {topicPapers.length > 0
                ? `${topicPapers[0].date.slice(0, 7)} → ${topicPapers[topicPapers.length - 1].date.slice(0, 7)}`
                : "—"}
            </div>
          </div>
          <div className="p-3 rounded-md bg-gray-50 dark:bg-[#0f1117] border border-gray-100 dark:border-gray-800">
            <div className="text-xs text-[#6b7280]">Stages</div>
            <div className="text-xl font-semibold text-[#2d6a4f] mt-0.5 tabular-nums">
              {Math.min(topicPapers.length, 6)}
            </div>
          </div>
          <div className="p-3 rounded-md bg-gray-50 dark:bg-[#0f1117] border border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <div>
              <div className="text-xs text-[#6b7280]">Synthesis</div>
              <div className="text-xs font-medium text-[#1a1a2e] dark:text-gray-200 mt-0.5">Gemini</div>
            </div>
            <button
              id="generate-topic-synthesis-btn"
              onClick={handleGenerateSynthesis}
              disabled={synthesisLoading || topicPapers.length === 0}
              className="p-2 bg-[#1a1a2e] dark:bg-gray-800 hover:bg-[#2a2a4e] dark:hover:bg-gray-700 disabled:opacity-40 text-white rounded-md transition-colors active:scale-[0.97] cursor-pointer"
              title="Generate synthesis"
            >
              <TrendingUp className={`w-4 h-4 ${synthesisLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* AI Synthesis */}
      {showSynthesis && (
        <div className="p-5 rounded-lg bg-white dark:bg-[#141520] border border-gray-200 dark:border-gray-800 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-[#1a1a2e] dark:text-gray-100 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#e63946]" />
              Evolution synthesis: {selectedTopic}
            </h3>
            <button
              onClick={() => setShowSynthesis(false)}
              className="text-xs text-[#6b7280] hover:text-[#1a1a2e] dark:hover:text-gray-200 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
          <div className="text-xs text-[#1a1a2e] dark:text-gray-300 leading-relaxed">
            {synthesisLoading ? (
              <div className="flex items-center gap-2 py-6 justify-center text-[#6b7280]">
                <RefreshCw className="w-4 h-4 animate-spin text-[#e63946]" />
                <span>Analyzing {topicPapers.length} papers…</span>
              </div>
            ) : (
              <div className="markdown-content">
                <ReactMarkdown
                  components={{
                    h1: ({ node, ...props }) => <h1 className="text-xl font-bold mt-6 mb-3 text-[#1a1a2e] dark:text-gray-100" {...props} />,
                    h2: ({ node, ...props }) => <h2 className="text-lg font-bold mt-5 mb-2 text-[#1a1a2e] dark:text-gray-100" {...props} />,
                    h3: ({ node, ...props }) => <h3 className="text-base font-semibold mt-4 mb-2 text-[#1a1a2e] dark:text-gray-100" {...props} />,
                    h4: ({ node, ...props }) => <h4 className="text-sm font-semibold mt-4 mb-2 text-[#1a1a2e] dark:text-gray-100" {...props} />,
                    p: ({ node, ...props }) => <p className="mb-3 leading-relaxed text-sm text-[#374151] dark:text-gray-300" {...props} />,
                    ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-3 space-y-1 text-sm text-[#374151] dark:text-gray-300" {...props} />,
                    ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mb-3 space-y-1 text-sm text-[#374151] dark:text-gray-300" {...props} />,
                    li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
                    strong: ({ node, ...props }) => <strong className="font-semibold text-[#111827] dark:text-gray-100" {...props} />,
                  }}
                >
                  {aiSynthesis}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Timeline + News */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Timeline (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#1a1a2e] dark:text-gray-100 flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-[#e63946]" />
              Method progression
            </h3>
            <span className="text-xs text-[#6b7280]">
              {topicPapers.length > 0 ? "Earliest → latest" : ""}
            </span>
          </div>

          {topicPapers.length === 0 ? (
            <div className="p-6 text-center rounded-lg bg-white dark:bg-[#141520] border border-gray-200 dark:border-gray-800 text-sm text-[#6b7280]">
              No papers for "{selectedTopic}." Select another topic or import more papers.
            </div>
          ) : (
            <div className="relative pl-6 space-y-4 before:absolute before:left-[9px] before:top-3 before:bottom-3 before:w-px before:bg-gray-200 dark:before:bg-gray-700">
              {topicPapers.map((paper, index) => {
                const prevPaper = index > 0 ? topicPapers[index - 1] : null;
                const isExpanded = !!expandedAbstracts[paper.id];
                const isFirst = index === 0;
                const isLast = index === topicPapers.length - 1 && topicPapers.length > 1;

                return (
                  <div
                    key={paper.id}
                    className="relative group p-4 rounded-lg bg-white dark:bg-[#141520] border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                  >
                    {/* Timeline dot */}
                    <div
                      className="absolute -left-[22px] top-5 w-[18px] h-[18px] rounded-full border-2 border-white dark:border-[#0f1117] flex items-center justify-center text-[9px] font-semibold text-white transition-transform group-hover:scale-110"
                      style={{
                        backgroundColor: isFirst ? "#1d3557" : isLast ? "#2d6a4f" : "#9ca3af",
                      }}
                    >
                      {index + 1}
                    </div>

                    {/* Meta */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#6b7280] tabular-nums">{paper.date}</span>
                        {isFirst && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#1d3557]/10 text-[#1d3557] dark:bg-blue-900/30 dark:text-blue-400">
                            Baseline
                          </span>
                        )}
                        {isLast && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#2d6a4f]/10 text-[#2d6a4f] dark:bg-emerald-900/30 dark:text-emerald-400">
                            Latest
                          </span>
                        )}
                        {paper.arxivId && (
                          <span className="text-[11px] text-[#6b7280] font-mono">{paper.arxivId}</span>
                        )}
                      </div>

                      <button
                        onClick={() => openComparison(paper, prevPaper || undefined)}
                        className="flex items-center gap-1 text-[11px] text-[#e63946] hover:text-[#c1292e] font-medium cursor-pointer"
                      >
                        <GitCompare className="w-3 h-3" />
                        <span>Compare</span>
                      </button>
                    </div>

                    {/* Title */}
                    <h4
                      onClick={() => onSelectPaper(paper)}
                      className="text-sm font-semibold text-[#1a1a2e] dark:text-gray-100 hover:text-[#e63946] cursor-pointer transition-colors leading-snug"
                    >
                      {paper.title}
                    </h4>

                    {/* Authors */}
                    <div className="text-xs text-[#6b7280] mt-1">
                      {paper.authors.slice(0, 4).join(", ")}
                      {paper.authors.length > 4 ? ` et al.` : ""}
                    </div>

                    {/* Method */}
                    <div className="mt-3 p-2.5 rounded-md bg-gray-50 dark:bg-[#0f1117] border border-gray-100 dark:border-gray-800">
                      <div className="text-[11px] text-[#6b7280] mb-0.5">Method</div>
                      <div className="text-xs font-medium font-mono text-[#1a1a2e] dark:text-gray-100">
                        {paper.method}
                      </div>
                    </div>

                    {/* Improvement over previous */}
                    {paper.improvesUpon && (
                      <div className="mt-3 p-3 rounded-md bg-[#2d6a4f]/5 dark:bg-emerald-900/10 border border-[#2d6a4f]/15 dark:border-emerald-800/30">
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#2d6a4f] dark:text-emerald-400 mb-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>
                            {prevPaper
                              ? `Improves on ${prevPaper.method.split(":")[0]}`
                              : "Advance over prior work"}
                          </span>
                        </div>
                        <p className="text-xs text-[#1a1a2e] dark:text-gray-200 leading-relaxed">
                          {paper.improvesUpon}
                        </p>
                        {paper.metricsOrGains && (
                          <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-[#2d6a4f] dark:text-emerald-400 bg-[#2d6a4f]/10 dark:bg-emerald-900/20 px-2 py-0.5 rounded w-fit">
                            <Zap className="w-3 h-3" />
                            <span>{paper.metricsOrGains}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Abstract toggle */}
                    <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-800">
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => toggleAbstract(paper.id)}
                          className="flex items-center gap-1 text-xs text-[#6b7280] hover:text-[#1a1a2e] dark:hover:text-gray-200 transition-colors cursor-pointer"
                        >
                          <BookOpen className="w-3 h-3" />
                          <span>{isExpanded ? "Hide abstract" : "Abstract"}</span>
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>

                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => onSelectPaper(paper)}
                            className="text-xs font-medium text-[#e63946] hover:text-[#c1292e] cursor-pointer"
                          >
                            Details →
                          </button>
                          {paper.url && (
                            <a
                              href={paper.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#6b7280] hover:text-[#1a1a2e] dark:hover:text-gray-200 text-xs flex items-center gap-0.5"
                            >
                              arXiv <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-2 p-3 rounded-md bg-gray-50 dark:bg-[#0f1117] border border-gray-100 dark:border-gray-800 text-xs text-[#6b7280] leading-relaxed">
                          {paper.abstract}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column (4 cols): News + Compare */}
        <div className="lg:col-span-4 space-y-5">
          {/* News feed */}
          <div className="p-4 rounded-lg bg-white dark:bg-[#141520] border border-gray-200 dark:border-gray-800 space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-[#1a1a2e] dark:text-gray-100 flex items-center gap-2">
                <Newspaper className="w-3.5 h-3.5 text-[#e63946]" />
                Recent news
              </h3>
              <button
                onClick={() => {
                  setNewsLoading(true);
                  fetch("/api/topic-news", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ topic: selectedTopic }),
                  })
                    .then((res) => res.json())
                    .then((data) => {
                      if (data.news) setNews(data.news);
                      setNewsLoading(false);
                    })
                    .catch(() => setNewsLoading(false));
                }}
                disabled={newsLoading}
                className="p-1 text-[#6b7280] hover:text-[#1a1a2e] dark:hover:text-gray-200 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${newsLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            <p className="text-xs text-[#6b7280]">
              Industry and research updates for <span className="font-medium text-[#1a1a2e] dark:text-gray-200">{selectedTopic}</span>.
            </p>

            {newsLoading ? (
              <div className="py-6 flex flex-col items-center justify-center text-xs text-[#6b7280] gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-[#e63946]" />
                <span>Fetching news…</span>
              </div>
            ) : newsError ? (
              <div className="p-2.5 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-400">
                {newsError}
              </div>
            ) : news.length === 0 ? (
              <div className="text-xs text-[#6b7280] py-4 text-center">
                No recent news for this topic.
              </div>
            ) : (
              <div className="space-y-2.5">
                {news.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-md bg-gray-50 dark:bg-[#0f1117] border border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 transition-colors space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[10px] text-[#6b7280]">
                      <span className="font-medium text-[#e63946]">{item.source}</span>
                      <span>{item.date}</span>
                    </div>
                    <a
                      href={item.url || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-[#1a1a2e] dark:text-gray-100 hover:text-[#e63946] transition-colors flex items-start gap-1 leading-snug"
                    >
                      <span>{item.title}</span>
                      <ExternalLink className="w-3 h-3 shrink-0 mt-0.5 text-[#6b7280]" />
                    </a>
                    <p className="text-[11px] text-[#6b7280] leading-relaxed">
                      {item.snippet}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Compare box */}
          <div className="p-4 rounded-lg bg-gray-50 dark:bg-[#141520] border border-gray-200 dark:border-gray-800 space-y-3">
            <h3 className="text-sm font-semibold text-[#1a1a2e] dark:text-gray-100 flex items-center gap-2">
              <GitCompare className="w-3.5 h-3.5 text-[#e63946]" />
              Compare methods
            </h3>
            <p className="text-xs text-[#6b7280] leading-relaxed">
              Select two papers to compare their mechanisms, gains, and tradeoffs side by side.
            </p>
            <button
              id="open-head-to-head-modal-btn"
              onClick={() => {
                if (topicPapers.length >= 2) {
                  setComparePaperA(topicPapers[0]);
                  setComparePaperB(topicPapers[1]);
                } else if (topicPapers.length === 1) {
                  setComparePaperA(topicPapers[0]);
                  setComparePaperB(null);
                }
                setShowCompareModal(true);
              }}
              className="w-full py-2 px-4 rounded-md bg-[#e63946] hover:bg-[#c1292e] text-white font-medium text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <GitCompare className="w-3.5 h-3.5" />
              Open comparison
            </button>
          </div>
        </div>
      </div>

      {/* Comparison modal */}
      {showCompareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg bg-white dark:bg-[#141520] border border-gray-200 dark:border-gray-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-[#1a1a2e] dark:text-gray-100 flex items-center gap-2">
                <GitCompare className="w-4 h-4 text-[#e63946]" />
                Method comparison
              </h3>
              <button
                onClick={() => setShowCompareModal(false)}
                className="text-[#6b7280] hover:text-[#1a1a2e] dark:hover:text-gray-200 text-sm px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Selectors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#1d3557] dark:text-blue-400">Paper A (baseline)</label>
                <select
                  value={comparePaperA?.id || ""}
                  onChange={(e) => {
                    const p = topicPapers.find((item) => item.id === e.target.value);
                    if (p) setComparePaperA(p);
                  }}
                  className="w-full p-2 bg-gray-50 dark:bg-[#0f1117] border border-gray-200 dark:border-gray-700 rounded-md text-xs text-[#1a1a2e] dark:text-gray-200 focus:outline-none focus:border-gray-400 cursor-pointer"
                >
                  {topicPapers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.date} — {p.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-[#2d6a4f] dark:text-emerald-400">Paper B (newer)</label>
                <select
                  value={comparePaperB?.id || ""}
                  onChange={(e) => {
                    const p = topicPapers.find((item) => item.id === e.target.value);
                    if (p) setComparePaperB(p);
                  }}
                  className="w-full p-2 bg-gray-50 dark:bg-[#0f1117] border border-gray-200 dark:border-gray-700 rounded-md text-xs text-[#1a1a2e] dark:text-gray-200 focus:outline-none focus:border-gray-400 cursor-pointer"
                >
                  {topicPapers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.date} — {p.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Table */}
            {comparePaperA && comparePaperB ? (
              <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-[#0f1117] border-b border-gray-200 dark:border-gray-700">
                      <th className="p-3 text-[#6b7280] font-medium w-1/4"></th>
                      <th className="p-3 text-[#1d3557] dark:text-blue-400 font-medium w-3/8">
                        {comparePaperA.title}
                      </th>
                      <th className="p-3 text-[#2d6a4f] dark:text-emerald-400 font-medium w-3/8">
                        {comparePaperB.title}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="p-3 font-medium text-[#6b7280]">Method</td>
                      <td className="p-3 text-[#1a1a2e] dark:text-gray-200 font-mono text-[11px]">{comparePaperA.method}</td>
                      <td className="p-3 text-[#1a1a2e] dark:text-gray-200 font-mono text-[11px]">{comparePaperB.method}</td>
                    </tr>
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="p-3 font-medium text-[#6b7280]">Innovation</td>
                      <td className="p-3 text-[#6b7280]">{comparePaperA.keyInnovation || "Novel formulation"}</td>
                      <td className="p-3 text-[#6b7280]">{comparePaperB.keyInnovation || "Targeted optimization"}</td>
                    </tr>
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="p-3 font-medium text-[#6b7280]">Improvement</td>
                      <td className="p-3 text-[#6b7280]">{comparePaperA.improvesUpon || "—"}</td>
                      <td className="p-3 text-[#2d6a4f] dark:text-emerald-400 font-medium">{comparePaperB.improvesUpon || "—"}</td>
                    </tr>
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="p-3 font-medium text-[#6b7280]">Gains</td>
                      <td className="p-3 text-[#6b7280]">{comparePaperA.metricsOrGains || "—"}</td>
                      <td className="p-3 text-[#2d6a4f] dark:text-emerald-400 font-medium">{comparePaperB.metricsOrGains || "—"}</td>
                    </tr>
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="p-3 font-medium text-[#6b7280]">Citations</td>
                      <td className="p-3 text-[#6b7280] tabular-nums">{comparePaperA.citationsCount || 0}</td>
                      <td className="p-3 text-[#6b7280] tabular-nums">{comparePaperB.citationsCount || 0}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-center text-[#6b7280] text-xs">
                Select two papers to compare.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
