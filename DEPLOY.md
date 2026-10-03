# Deploying to Vercel (Free)

## What Changed

Your project has been restructured for Vercel deployment:

| Component | Before (Local) | After (Vercel) |
|---|---|---|
| Paper data | SQLite DB via Express API | Static JSON in `public/data/` |
| AI Analysis | Express → Gemini/Ollama | Vercel Serverless Functions → Gemini |
| Topic News | Express proxy | Vercel Serverless Function |
| RAG Q&A | Python + sentence-transformers | Keyword search + Gemini (serverless) |
| arXiv Fetch | Express proxy | Direct browser fetch (arXiv API) |

## Step-by-Step Deployment

### 1. Push to GitHub

```bash
# Initialize git (if not already)
cd /Users/shoaib/Desktop/arxiv-paper-network-\&-topic-evolution
git init
git add -A
git commit -m "Initial commit - Vercel ready"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/arxiv-paper-network.git
git branch -M main
git push -u origin main
```

### 2. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign up with your GitHub account (free)
2. Click **"Add New Project"**
3. Select your `arxiv-paper-network` repository
4. Vercel will auto-detect Vite — the settings should be:
   - **Framework Preset**: Vite
   - **Build Command**: `vite build`
   - **Output Directory**: `dist`
5. Add **Environment Variables**:
   - `GEMINI_API_KEY` = your Gemini API key (get free at [aistudio.google.com/apikey](https://aistudio.google.com/apikey))
   - `NEWSDATA_API_KEY` = (optional) your NewsData API key
6. Click **Deploy**

### 3. That's it! 🎉

Your app will be live at `https://your-project.vercel.app`

## Updating Paper Data

When you add new papers to your local SQLite database, re-export them:

```bash
python3 scripts/export-db-to-json.py /path/to/papers.db
git add public/data/
git commit -m "Update paper data"
git push
```

Vercel will automatically redeploy.

## Local Development

The project still works locally with the Express server:

```bash
# With SQLite (full features)
npm run dev

# Or just the Vite frontend (uses static JSON)
npx vite
```

## File Structure

```
├── api/                     # Vercel Serverless Functions
│   ├── analyze-topic.js     # Gemini topic analysis
│   ├── categorize-paper.js  # Gemini paper categorization
│   ├── rag-qa.js           # Keyword search + Gemini Q&A
│   └── topic-news.js       # NewsData API proxy
├── public/
│   └── data/               # Static JSON (exported from SQLite)
│       ├── papers.json
│       ├── categories.json
│       └── db-stats.json
├── scripts/
│   └── export-db-to-json.py # DB → JSON export script
├── server.ts               # Express server (local dev only)
├── vercel.json             # Vercel configuration
└── src/                    # React frontend
```
