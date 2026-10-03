import { useState, useMemo } from "react";
import { Paper } from "../types";
import { getCategoryColor } from "../utils/graphUtils";
import { 
  Search, 
  ExternalLink, 
  ArrowUpDown, 
  Filter,
  TrendingUp
} from "lucide-react";

interface PaperTableProps {
  papers: Paper[];
  onSelectPaper: (paper: Paper) => void;
  onExploreTopic: (topic: string) => void;
}

export default function PaperTable({
  papers,
  onSelectPaper,
  onExploreTopic,
}: PaperTableProps) {
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"date-desc" | "date-asc" | "citations" | "title">("date-desc");

  const categories = useMemo(() => {
    const set = new Set<string>();
    papers.forEach((p) => p.categories.forEach((c) => set.add(c)));
    return Array.from(set).sort();
  }, [papers]);

  const filteredPapers = useMemo(() => {
    return papers
      .filter((p) => {
        if (selectedCat !== "ALL" && !p.categories.includes(selectedCat)) {
          return false;
        }
        if (search.trim()) {
          const q = search.toLowerCase();
          const mTitle = p.title.toLowerCase().includes(q);
          const mAuthor = p.authors.some((a) => a.toLowerCase().includes(q));
          const mMethod = p.method.toLowerCase().includes(q);
          const mCat = p.categories.some((c) => c.toLowerCase().includes(q));
          if (!mTitle && !mAuthor && !mMethod && !mCat) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "date-desc") return new Date(b.date).getTime() - new Date(a.date).getTime();
        if (sortBy === "date-asc") return new Date(a.date).getTime() - new Date(b.date).getTime();
        if (sortBy === "citations") return (b.citationsCount || 0) - (a.citationsCount || 0);
        return a.title.localeCompare(b.title);
      });
  }, [papers, selectedCat, search, sortBy]);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="p-3 rounded-lg bg-white dark:bg-[#141520] border border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search title, method, author…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7 pr-3 py-1.5 w-56 md:w-72 bg-gray-50 dark:bg-[#0f1117] border border-gray-200 dark:border-gray-700 rounded-md text-xs text-[#1a1a2e] dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:border-gray-400"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="w-3 h-3 text-[#6b7280]" />
            <select
              value={selectedCat}
              onChange={(e) => setSelectedCat(e.target.value)}
              className="py-1.5 px-2.5 bg-gray-50 dark:bg-[#0f1117] border border-gray-200 dark:border-gray-700 rounded-md text-xs text-[#1a1a2e] dark:text-gray-200 focus:outline-none focus:border-gray-400 cursor-pointer"
            >
              <option value="ALL">All topics ({papers.length})</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-3 h-3 text-[#6b7280]" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="py-1.5 px-2.5 bg-gray-50 dark:bg-[#0f1117] border border-gray-200 dark:border-gray-700 rounded-md text-xs text-[#1a1a2e] dark:text-gray-200 focus:outline-none focus:border-gray-400 cursor-pointer"
          >
            <option value="date-desc">Newest first</option>
            <option value="date-asc">Oldest first</option>
            <option value="citations">Most cited</option>
            <option value="title">A–Z</option>
          </select>
          <span className="text-xs text-[#6b7280] tabular-nums">
            <span className="font-semibold text-[#e63946]">{filteredPapers.length}</span> papers
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden bg-white dark:bg-[#141520]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 dark:bg-[#0f1117] border-b border-gray-200 dark:border-gray-800 text-[#6b7280] text-[11px] font-medium">
                <th className="p-3 w-24">Date</th>
                <th className="p-3">Title</th>
                <th className="p-3">Topics</th>
                <th className="p-3">Method</th>
                <th className="p-3">Improvement</th>
                <th className="p-3 text-right w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredPapers.map((paper) => {
                return (
                  <tr
                    key={paper.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group cursor-pointer"
                    onClick={() => onSelectPaper(paper)}
                  >
                    <td className="p-3 text-[#6b7280] text-[11px] whitespace-nowrap tabular-nums">
                      {paper.date}
                    </td>

                    <td className="p-3 max-w-sm">
                      <div className="font-medium text-[#1a1a2e] dark:text-gray-100 group-hover:text-[#e63946] transition-colors line-clamp-2 leading-snug">
                        {paper.title}
                      </div>
                      <div className="text-[11px] text-[#6b7280] mt-0.5 line-clamp-1">
                        {paper.authors.join(", ")}
                      </div>
                    </td>

                    <td className="p-3 max-w-xs">
                      <div className="flex flex-wrap gap-1">
                        {paper.categories.slice(0, 3).map((c) => (
                          <span
                            key={c}
                            className="px-1.5 py-0.5 rounded text-[10px] font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-[#6b7280]"
                          >
                            {c}
                          </span>
                        ))}
                        {paper.categories.length > 3 && (
                          <span className="text-[10px] text-gray-400 self-center">
                            +{paper.categories.length - 3}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-3 max-w-xs">
                      <div className="text-[#1a1a2e] dark:text-gray-200 font-mono text-[11px] line-clamp-2">
                        {paper.method}
                      </div>
                    </td>

                    <td className="p-3 max-w-xs">
                      {paper.improvesUpon ? (
                        <div className="line-clamp-2 text-xs text-[#2d6a4f] dark:text-emerald-400">
                          {paper.improvesUpon}
                        </div>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">—</span>
                      )}
                    </td>

                    <td
                      className="p-3 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onExploreTopic(paper.primaryCategory || paper.categories[0])}
                          className="p-1 rounded-md bg-gray-50 dark:bg-gray-800 hover:bg-[#e63946] hover:text-white text-[#6b7280] border border-gray-200 dark:border-gray-700 transition-colors cursor-pointer"
                          title="Explore topic"
                        >
                          <TrendingUp className="w-3 h-3" />
                        </button>
                        {paper.url && (
                          <a
                            href={paper.url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 rounded-md bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-[#6b7280] border border-gray-200 dark:border-gray-700 transition-colors"
                            title="Open on arXiv"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
