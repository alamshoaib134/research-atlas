#!/usr/bin/env python3
"""
Export papers.db to static JSON files that match the server.ts API shape.
Run: python3 scripts/export-db-to-json.py /path/to/papers.db
"""
import sqlite3
import json
import sys
import os

def parse_json_array(raw):
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, list) else []
    except:
        return [s.strip().strip('"').strip("'") for s in raw.strip("[]").split(",") if s.strip()]

def transform_paper(row, explanation=None):
    arxiv_categories = parse_json_array(row["arxiv_categories"])
    ai_keywords = parse_json_array(row["ai_keywords"])
    
    all_categories = list(arxiv_categories)
    for kw in ai_keywords:
        if not any(c.lower() == kw.lower() for c in all_categories):
            all_categories.append(kw)
    categories = all_categories if all_categories else ["Artificial Intelligence"]
    
    authors_raw = row["authors"] or ""
    authors = [a.strip() for a in authors_raw.split(",") if a.strip()] or ["Unknown"]
    
    org_name = None
    if row.get("organization"):
        try:
            org = json.loads(row["organization"])
            org_name = org.get("fullname") or org.get("name")
        except:
            pass
    
    date_str = row.get("published_date") or ""
    if "T" in date_str:
        date_str = date_str.split("T")[0]
    
    paper = {
        "id": row["paper_id"],
        "arxivId": row["paper_id"],
        "title": row.get("title") or "Untitled Paper",
        "authors": authors,
        "date": date_str,
        "categories": categories,
        "primaryCategory": categories[0],
        "abstract": row.get("abstract") or "No abstract available.",
        "method": row.get("proposed_method") or "Research contribution",
        "citationsCount": row.get("upvotes") or 0,
        "url": row.get("source_url") or f"https://arxiv.org/abs/{row['paper_id']}",
        "aiSummary": row.get("ai_summary") or None,
        "githubRepo": row.get("github_repo") or None,
        "githubStars": row.get("github_stars") or None,
        "organization": org_name,
        "upvotes": row.get("upvotes") or 0,
        "task": row.get("task") or None,
        "stanceType": row.get("stance_type") or None,
    }
    
    if row.get("stance_desc"):
        paper["improvesUpon"] = row["stance_desc"]
    if row.get("core_claim"):
        paper["keyInnovation"] = row["core_claim"]
        paper["metricsOrGains"] = row["core_claim"]
    if explanation:
        paper["explanation"] = explanation
    
    # Remove None values to keep JSON clean
    return {k: v for k, v in paper.items() if v is not None}

def main():
    db_path = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("DB_PATH")
    if not db_path:
        print("Usage: python3 export-db-to-json.py /path/to/papers.db")
        sys.exit(1)
    
    out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "data")
    os.makedirs(out_dir, exist_ok=True)
    
    db = sqlite3.connect(db_path)
    db.row_factory = sqlite3.Row
    
    # Load explanations
    explanations = {}
    try:
        for r in db.execute("SELECT paper_id, explanation FROM explanations"):
            explanations[r["paper_id"]] = r["explanation"]
    except:
        pass
    
    # Export papers
    rows = db.execute("""
        SELECT 
            pd.paper_id, pd.title, pd.authors, pd.published_date, pd.abstract,
            pd.arxiv_categories, pd.ai_keywords, pd.ai_summary,
            pd.upvotes, pd.github_repo, pd.github_stars, pd.organization,
            pd.source_url,
            pc.task, pc.core_claim, pc.proposed_method, pc.baseline,
            pc.stance_type, pc.stance_desc
        FROM paper_details pd
        LEFT JOIN paper_claims pc ON pd.paper_id = pc.paper_id
        ORDER BY pd.published_date DESC
    """).fetchall()
    
    papers = []
    for row in rows:
        row_dict = dict(row)
        explanation = explanations.get(row_dict["paper_id"])
        papers.append(transform_paper(row_dict, explanation))
    
    # Write papers.json
    with open(os.path.join(out_dir, "papers.json"), "w") as f:
        json.dump(papers, f, separators=(",", ":"))
    
    # Compute categories with counts
    cat_counts = {}
    for p in papers:
        seen = set()
        for c in p["categories"]:
            lc = c.lower()
            if lc not in seen:
                seen.add(lc)
                cat_counts[c] = cat_counts.get(c, 0) + 1
    
    categories = sorted(
        [{"name": name, "count": count} for name, count in cat_counts.items()],
        key=lambda x: -x["count"]
    )
    
    with open(os.path.join(out_dir, "categories.json"), "w") as f:
        json.dump(categories, f, separators=(",", ":"))
    
    # Compute stats
    claims_count = db.execute("SELECT COUNT(*) as cnt FROM paper_claims").fetchone()["cnt"]
    stats = {
        "papers": len(papers),
        "claims": claims_count,
        "explanations": len(explanations),
        "available": True,
    }
    
    with open(os.path.join(out_dir, "db-stats.json"), "w") as f:
        json.dump(stats, f, separators=(",", ":"))
    
    db.close()
    
    print(f"✅ Exported to {out_dir}/")
    print(f"   papers.json    — {len(papers)} papers ({os.path.getsize(os.path.join(out_dir, 'papers.json')) // 1024} KB)")
    print(f"   categories.json — {len(categories)} categories")
    print(f"   db-stats.json  — {stats}")

if __name__ == "__main__":
    main()
