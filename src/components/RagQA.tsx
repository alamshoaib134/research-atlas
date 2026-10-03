import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Bot, User, Database, ChevronRight, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Paper } from "../types";

export default function RagQA({ papers = [], onSelectPaper }: { papers?: Paper[], onSelectPaper?: (paper: Partial<Paper>) => void }) {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant", content: string, citations?: any[] }>>([
    {
      role: "assistant",
      content: "Hello! I can answer questions about the research papers in this database using vector search and retrieval-augmented generation (RAG). What would you like to know?",
    }
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    const userMessage = query.trim();
    setQuery("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch("/api/rag-qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMessage, papers })
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: data.answer, 
        citations: data.citations 
      }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: `Sorry, I encountered an error: ${err.message}` 
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] bg-white dark:bg-[#141520] border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-800 bg-[#f8f7f4] dark:bg-[#0f1117]">
        <Database className="w-4 h-4 text-[#e63946]" />
        <h2 className="text-sm font-semibold text-[#1a1a2e] dark:text-gray-100">Research Q&A</h2>
        <span className="text-xs text-[#6b7280] ml-2 px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-800">Powered by RAG</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              msg.role === "user" 
                ? "bg-[#1a1a2e] dark:bg-gray-700 text-white" 
                : "bg-[#e63946] text-white"
            }`}>
              {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            
            <div className={`max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-2`}>
              <div className={`px-4 py-3 rounded-2xl ${
                msg.role === "user" 
                  ? "bg-[#1a1a2e] dark:bg-gray-800 text-white rounded-tr-sm" 
                  : "bg-gray-100 dark:bg-[#1f2130] text-[#1a1a2e] dark:text-gray-200 rounded-tl-sm text-sm leading-relaxed"
              }`}>
                {msg.role === "user" ? (
                  <p>{msg.content}</p>
                ) : (
                  <div className="markdown-content">
                    <ReactMarkdown
                      components={{
                        p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                        ul: ({ node, ...props }) => <ul className="list-disc pl-4 mb-2 space-y-1" {...props} />,
                        ol: ({ node, ...props }) => <ol className="list-decimal pl-4 mb-2 space-y-1" {...props} />,
                        a: ({ node, ...props }) => <a className="text-[#e63946] hover:underline" {...props} />,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>

              {/* Citations */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="w-full mt-2 space-y-2">
                  <div className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider">Retrieved Sources</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {msg.citations.map((cite, i) => (
                      <button 
                        key={i}
                        onClick={() => {
                          if (onSelectPaper && papers) {
                            const fullPaper = papers.find(p => p.id === cite.paper_id);
                            if (fullPaper) {
                              onSelectPaper(fullPaper);
                            } else {
                              onSelectPaper({ id: cite.paper_id, title: cite.title, authors: cite.authors, categories: [] });
                            }
                          }
                        }}
                        className="flex items-start gap-2 p-2 rounded bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-[#e63946] dark:hover:border-[#e63946] transition-colors text-left cursor-pointer group"
                      >
                        <div className="text-xs font-bold text-[#e63946] shrink-0">[{i + 1}]</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-[#1a1a2e] dark:text-gray-200 truncate group-hover:text-[#e63946] transition-colors">
                            {cite.title}
                          </div>
                          <div className="text-[10px] text-[#6b7280] line-clamp-2 mt-0.5 leading-snug">
                            {cite.text_content}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-[#e63946] text-white flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-gray-100 dark:bg-[#1f2130] flex items-center gap-2 text-[#6b7280] text-sm">
              <Loader2 className="w-4 h-4 animate-spin text-[#e63946]" />
              Searching database...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white dark:bg-[#141520] border-t border-gray-200 dark:border-gray-800">
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a question about the research..."
            disabled={loading}
            className="w-full bg-gray-50 dark:bg-[#0f1117] border border-gray-200 dark:border-gray-800 rounded-lg pl-4 pr-12 py-3 text-sm text-[#1a1a2e] dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#e63946] focus:border-[#e63946] transition-shadow disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!query.trim() || loading}
            className="absolute right-2 top-2 p-1.5 bg-[#1a1a2e] dark:bg-gray-800 text-white rounded-md hover:bg-[#e63946] dark:hover:bg-[#e63946] disabled:opacity-50 disabled:hover:bg-[#1a1a2e] transition-colors cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
