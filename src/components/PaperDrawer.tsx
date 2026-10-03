import { Paper } from "../types";
import ReactMarkdown from "react-markdown";
import { getCategoryColor } from "../utils/graphUtils";
import { usePaperDetails } from "../hooks/useDatabase";
import { 
  X, 
  ExternalLink, 
  Calendar, 
  User, 
  CheckCircle2, 
  Zap,
  TrendingUp,
  Github,
  Star,
  ArrowUp,
  Building2,
  Brain,
  Loader2
} from "lucide-react";

interface PaperDrawerProps {
  paper: Paper | null;
  onClose: () => void;
  onExploreTopic: (topic: string) => void;
  allPapers: Paper[];
  onSelectPaper: (paper: Paper) => void;
}

export default function PaperDrawer({
  paper,
  onClose,
  onExploreTopic,
  allPapers,
  onSelectPaper,
}: PaperDrawerProps) {
  const { details, loading: detailsLoading } = usePaperDetails(paper?.id || null);

  if (!paper) return null;

  const relatedPapers = allPapers
    .filter(
      (p) =>
        p.id !== paper.id &&
        p.categories.some((c) => paper.categories.includes(c))
    )
    .slice(0, 4);

  const primaryColor = getCategoryColor(paper.primaryCategory || paper.categories[0] || "");

  const aiSummary = details?.aiSummary || (paper as any)?.aiSummary;
  const explanation = details?.explanation;
  const githubRepo = details?.githubRepo || (paper as any)?.githubRepo;
  const githubStars = details?.githubStars || (paper as any)?.githubStars;
  const upvotes = details?.upvotes || (paper as any)?.upvotes || paper.citationsCount;
  const organization = details?.organization || (paper as any)?.organization;
  const stanceType = details?.stanceType || (paper as any)?.stanceType;
  const task = details?.task || (paper as any)?.task;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white dark:bg-[#141520] border-l border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col transform transition-transform duration-200 ease-out">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between gap-4">
        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-medium border"
              style={{
                backgroundColor: `${primaryColor}10`,
                color: primaryColor,
                borderColor: `${primaryColor}25`,
              }}
            >
              {paper.primaryCategory || paper.categories[0]}
            </span>
            <span className="text-xs text-[#6b7280] flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {paper.date}
            </span>
            {stanceType && (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                stanceType === "Improves"
                  ? "bg-[#2d6a4f]/10 text-[#2d6a4f] dark:bg-emerald-900/30 dark:text-emerald-400"
                  : stanceType === "Novel"
                  ? "bg-[#1d3557]/10 text-[#1d3557] dark:bg-blue-900/30 dark:text-blue-400"
                  : "bg-gray-100 dark:bg-gray-800 text-[#6b7280]"
              }`}>
                {stanceType}
              </span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-[#1a1a2e] dark:text-gray-100 leading-snug">
            {paper.title}
          </h3>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-md text-[#6b7280] hover:text-[#1a1a2e] dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Metadata badges */}
        {(upvotes > 0 || githubRepo || organization) && (
          <div className="flex items-center gap-2 flex-wrap">
            {upvotes > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-400 text-xs font-medium">
                <ArrowUp className="w-3 h-3" />
                <span>{upvotes}</span>
              </div>
            )}
            {githubRepo && (
              <a
                href={githubRepo}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-[#6b7280] hover:text-[#1a1a2e] dark:hover:text-gray-200 text-xs font-medium transition-colors"
              >
                <Github className="w-3 h-3" />
                <span>Code</span>
                {githubStars > 0 && (
                  <span className="flex items-center gap-0.5 text-amber-600">
                    <Star className="w-3 h-3" />
                    {githubStars >= 1000 ? `${(githubStars / 1000).toFixed(1)}k` : githubStars}
                  </span>
                )}
              </a>
            )}
            {organization && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#1d3557]/5 dark:bg-blue-900/20 border border-[#1d3557]/15 dark:border-blue-800/30 text-[#1d3557] dark:text-blue-400 text-xs">
                <Building2 className="w-3 h-3" />
                <span>{organization}</span>
              </div>
            )}
          </div>
        )}

        {/* Task */}
        {task && (
          <div className="text-xs text-[#6b7280]">
            Task: <span className="font-medium text-[#1a1a2e] dark:text-gray-200">{task}</span>
          </div>
        )}

        {/* Authors */}
        <div className="flex items-start gap-2 text-[#6b7280]">
          <User className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <div>
            <div className="text-[11px] text-[#6b7280] mb-0.5">Authors</div>
            <div className="text-xs text-[#1a1a2e] dark:text-gray-200">{paper.authors.join(", ")}</div>
          </div>
        </div>

        {/* Categories */}
        <div className="space-y-1.5">
          <div className="text-[11px] text-[#6b7280]">
            Topics ({paper.categories.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Array.from(new Set(paper.categories)).map((cat, idx) => (
              <button
                key={`${cat}-${idx}`}
                onClick={() => {
                  onExploreTopic(cat);
                  onClose();
                }}
                className="px-2 py-0.5 rounded-md text-xs font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-[#6b7280] hover:text-white hover:bg-[#e63946] hover:border-[#e63946] transition-colors cursor-pointer"
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* AI Summary */}
        {aiSummary && (
          <div className="p-3 rounded-md bg-violet-50/50 dark:bg-violet-900/10 border border-violet-200/60 dark:border-violet-800/30 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-violet-700 dark:text-violet-400">
              <Brain className="w-3 h-3" />
              <span>AI summary</span>
            </div>
            <p className="text-xs text-[#1a1a2e] dark:text-gray-200 leading-relaxed">
              {aiSummary}
            </p>
          </div>
        )}

        {/* Method */}
        <div className="p-3 rounded-md bg-gray-50 dark:bg-[#0f1117] border border-gray-100 dark:border-gray-800 space-y-1">
          <div className="text-[11px] text-[#e63946] font-medium">Method</div>
          <p className="text-xs font-medium font-mono text-[#1a1a2e] dark:text-gray-100 leading-relaxed">
            {paper.method}
          </p>
          {paper.keyInnovation && (
            <p className="text-xs text-[#6b7280] mt-1 pt-1 border-t border-gray-100 dark:border-gray-800">
              {paper.keyInnovation}
            </p>
          )}
        </div>

        {/* Improvement */}
        {paper.improvesUpon && (
          <div className="p-3 rounded-md bg-[#2d6a4f]/5 dark:bg-emerald-900/10 border border-[#2d6a4f]/15 dark:border-emerald-800/30 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#2d6a4f] dark:text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              <span>Advance over prior work</span>
            </div>
            <p className="text-xs text-[#1a1a2e] dark:text-gray-200 leading-relaxed">
              {paper.improvesUpon}
            </p>
            {paper.metricsOrGains && (
              <div className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-[#2d6a4f] dark:text-emerald-400 bg-[#2d6a4f]/10 dark:bg-emerald-900/20 px-2 py-0.5 rounded w-fit">
                <Zap className="w-3 h-3" />
                <span>{paper.metricsOrGains}</span>
              </div>
            )}
          </div>
        )}

        {/* AI Explanation */}
        {explanation && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1 text-[11px] text-[#6b7280]">
              <span>Explanation</span>
              {detailsLoading && <Loader2 className="w-3 h-3 animate-spin" />}
            </div>
            <div className="p-3 rounded-md bg-gray-50 dark:bg-[#0f1117] border border-gray-100 dark:border-gray-800 text-xs text-[#6b7280] leading-relaxed markdown-content">
              <ReactMarkdown
                components={{
                  h1: ({ node, ...props }) => <h1 className="text-sm font-bold mt-3 mb-1.5 text-[#1a1a2e] dark:text-gray-200" {...props} />,
                  h2: ({ node, ...props }) => <h2 className="text-[13px] font-bold mt-3 mb-1.5 text-[#1a1a2e] dark:text-gray-200" {...props} />,
                  h3: ({ node, ...props }) => <h3 className="text-xs font-semibold mt-2.5 mb-1 text-[#1a1a2e] dark:text-gray-200" {...props} />,
                  p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                  ul: ({ node, ...props }) => <ul className="list-disc pl-4 mb-2 space-y-0.5" {...props} />,
                  ol: ({ node, ...props }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5" {...props} />,
                  li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
                  strong: ({ node, ...props }) => <strong className="font-semibold text-[#1a1a2e] dark:text-gray-200" {...props} />,
                }}
              >
                {explanation}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* Abstract */}
        <div className="space-y-1.5">
          <div className="text-[11px] text-[#6b7280]">Abstract</div>
          <div className="p-3 rounded-md bg-gray-50 dark:bg-[#0f1117] border border-gray-100 dark:border-gray-800 text-xs text-[#6b7280] leading-relaxed">
            {paper.abstract}
          </div>
        </div>

        {/* Related papers */}
        {relatedPapers.length > 0 && (
          <div className="space-y-2 pt-3 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between text-[11px] text-[#6b7280]">
              <span>Related papers</span>
              <span className="text-[#e63946]">{relatedPapers.length}</span>
            </div>
            <div className="space-y-1.5">
              {relatedPapers.map((rel) => (
                <div
                  key={rel.id}
                  onClick={() => onSelectPaper(rel)}
                  className="p-2 rounded-md bg-gray-50 dark:bg-[#0f1117] border border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 cursor-pointer transition-colors"
                >
                  <div className="font-medium text-[#1a1a2e] dark:text-gray-100 text-xs line-clamp-1">
                    {rel.title}
                  </div>
                  <div className="text-[10px] font-mono text-[#6b7280] mt-0.5 line-clamp-1">
                    {rel.method}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3">
        <button
          onClick={() => {
            onExploreTopic(paper.primaryCategory || paper.categories[0]);
            onClose();
          }}
          className="flex-1 py-2 px-4 rounded-md bg-[#e63946] hover:bg-[#c1292e] text-white font-medium text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Topic evolution</span>
        </button>

        {paper.url && (
          <a
            href={paper.url}
            target="_blank"
            rel="noreferrer"
            className="py-2 px-3 rounded-md bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-[#6b7280] border border-gray-200 dark:border-gray-700 font-medium text-xs transition-colors flex items-center gap-1.5 shrink-0"
          >
            arXiv <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}
