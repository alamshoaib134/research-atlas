import sys
import json
import sqlite3
import numpy as np
from sentence_transformers import SentenceTransformer
import warnings

# Suppress warnings
warnings.filterwarnings('ignore')

def cosine_similarity(a, b):
    # a and b are 1D arrays
    # Avoid division by zero
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return np.dot(a, b) / (norm_a * norm_b)

def main():
    if len(sys.argv) < 4:
        print(json.dumps({"error": "Missing arguments"}))
        return

    query = sys.argv[1]
    db_path = sys.argv[2]
    top_k = int(sys.argv[3])

    try:
        model = SentenceTransformer("all-MiniLM-L6-v2")
        query_emb = model.encode(query)
    except Exception as e:
        print(json.dumps({"error": f"Model loading failed: {str(e)}"}))
        return

    try:
        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        c.execute("SELECT paper_id, chunk_index, text_content, embedding FROM paper_embeddings")
        rows = c.fetchall()
        
        results = []
        for row in rows:
            paper_id, chunk_index, text_content, emb_blob = row
            if not emb_blob:
                continue
            emb_arr = np.frombuffer(emb_blob, dtype=np.float32)
            if len(emb_arr) != len(query_emb):
                continue
            score = float(cosine_similarity(query_emb, emb_arr))
            results.append({
                "paper_id": paper_id,
                "chunk_index": chunk_index,
                "text_content": text_content,
                "score": score
            })

        results.sort(key=lambda x: x["score"], reverse=True)
        top_results = results[:top_k]

        # Fetch titles for citations
        for r in top_results:
            c.execute("SELECT title, authors FROM paper_details WHERE paper_id = ?", (r["paper_id"],))
            meta_row = c.fetchone()
            if meta_row:
                r["title"] = meta_row[0]
                authors_raw = meta_row[1]
                if authors_raw:
                    try:
                        authors = json.loads(authors_raw)
                        r["authors"] = authors
                    except:
                        r["authors"] = [authors_raw]
                else:
                    r["authors"] = []
            else:
                r["title"] = "Unknown Title"
                r["authors"] = []

        print(json.dumps({"success": True, "results": top_results}))
    except Exception as e:
        print(json.dumps({"error": f"Search failed: {str(e)}"}))

if __name__ == "__main__":
    main()
