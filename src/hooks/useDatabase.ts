import { useState, useEffect, useCallback } from "react";
import { Paper } from "../types";
import { FALLBACK_PAPERS } from "../data/papersData";

interface UsePapersResult {
  papers: Paper[];
  loading: boolean;
  error: string | null;
  dbAvailable: boolean;
  dbStats: { papers: number; claims: number; explanations: number } | null;
  refetch: () => void;
  setPapers: (papers: Paper[]) => void;
}

export function usePapers(): UsePapersResult {
  const [papers, setPapersState] = useState<Paper[]>(() => {
    // Try loading from localStorage cache first for instant display
    try {
      const saved = localStorage.getItem("arxiv_custom_papers");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return FALLBACK_PAPERS;
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dbAvailable, setDbAvailable] = useState(false);
  const [dbStats, setDbStats] = useState<{ papers: number; claims: number; explanations: number } | null>(null);

  const fetchPapers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Load from static JSON files (works on Vercel and locally)
      const [papersRes, statsRes] = await Promise.all([
        fetch("/data/papers.json"),
        fetch("/data/db-stats.json"),
      ]);

      if (!papersRes.ok) {
        // Fallback: try the Express API endpoint (for local dev with server.ts)
        const apiRes = await fetch("/api/papers");
        if (apiRes.ok) {
          const papersData = await apiRes.json();
          if (Array.isArray(papersData) && papersData.length > 0) {
            setPapersState(papersData);
            setDbAvailable(true);
            try {
              localStorage.setItem("arxiv_custom_papers", JSON.stringify(papersData));
            } catch { /* storage quota */ }
            setLoading(false);
            return;
          }
        }
        throw new Error("Could not load papers data");
      }

      const papersData = await papersRes.json();

      if (Array.isArray(papersData) && papersData.length > 0) {
        setPapersState(papersData);
        setDbAvailable(true);

        // Cache in localStorage for offline fallback
        try {
          localStorage.setItem("arxiv_custom_papers", JSON.stringify(papersData));
        } catch {
          // storage quota
        }
      } else {
        // Data is empty, use fallback
        setPapersState(FALLBACK_PAPERS);
        setDbAvailable(false);
      }

      // Parse stats
      if (statsRes.ok) {
        const stats = await statsRes.json();
        if (stats.available) {
          setDbStats(stats);
        }
      }
    } catch (err: any) {
      console.warn("Failed to fetch papers, using cached/fallback data:", err.message);
      setError(err.message);
      setDbAvailable(false);
      // Keep whatever papers we have (cached or fallback)
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPapers();
  }, [fetchPapers]);

  // Sync to localStorage when papers change
  useEffect(() => {
    try {
      localStorage.setItem("arxiv_custom_papers", JSON.stringify(papers));
    } catch {
      // storage quota
    }
  }, [papers]);

  const setPapers = useCallback((newPapers: Paper[]) => {
    setPapersState(newPapers);
  }, []);

  return {
    papers,
    loading,
    error,
    dbAvailable,
    dbStats,
    refetch: fetchPapers,
    setPapers,
  };
}

// Hook: Fetch full paper details by ID — now searches the loaded papers array
// rather than hitting a backend endpoint
export function usePaperDetails(paperId: string | null) {
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!paperId) {
      setDetails(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    // Try static JSON first, then fallback to API
    fetch("/data/papers.json")
      .then((res) => (res.ok ? res.json() : null))
      .then((papers) => {
        if (!cancelled && papers) {
          const found = papers.find((p: any) => p.id === paperId);
          if (found) {
            setDetails(found);
            setLoading(false);
            return;
          }
        }
        // Fallback to API (for local dev)
        return fetch(`/api/papers/${encodeURIComponent(paperId)}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (!cancelled && data) {
              setDetails(data);
            }
            setLoading(false);
          });
      })
      .catch(() => {
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [paperId]);

  return { details, loading };
}
