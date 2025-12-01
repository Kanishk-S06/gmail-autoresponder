# ReplyPilot 📬🤖  
### LLM-Powered Gmail Auto-Responder with Full Thread Awareness

ReplyPilot is an AI-assisted Gmail automation system built with **Next.js**, **TypeScript**, **Prisma**, **Google OAuth2**, **Gmail API**, and **Ollama (local LLM)**. It automatically drafts context-aware replies for incoming email threads while ensuring full privacy through local LLM inference.

## 🚀 Features

### ✉️ Full Gmail Thread Parsing  
- Reads full Gmail conversation history  
- Extracts RFC-822 headers for proper threading  
- Understands past context, tone, and sender intent  
- Prevents reply-chain breaks

### 🧠 Local LLM Draft Generation (via Ollama)
- Privacy-preserving, offline inference  
- Context-aware email replies  
- Custom system prompts + personality profiles  
- No data leaves your machine

### 🔄 Per-Sender Behavioral Profiling  
- Learns tone, style, and length from past replies  
- Generates increasingly personalized responses  
- Maintains consistent communication patterns

### 🛠️ “Learn-From-My-Edit” Reinforcement Loop  
- When a user edits a draft, the system learns from it  
- Improves tone, formatting, and content match over time

### 🏷️ Automated Review Workflow  
- Drafts stored as Gmail **Drafts**, not auto-sent  
- Applies labels (e.g., `ReplyPilot/Review`)  
- Avoids auto-responder loops  
- Ensures safe, supervised automation

## 🧩 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js, React, TailwindCSS |
| Backend | Next.js API Routes, TypeScript |
| Database | Prisma ORM (SQLite/Postgres) |
| Auth | Google OAuth 2.0 |
| Email Processing | Gmail API |
| LLM Engine | Ollama (local models) |
| Deployment | Local / Vercel |

## 📦 Installation & Setup

### 1️⃣ Clone Repository
```bash
git clone https://github.com/Kanishk-S06/gmail-autoresponder
cd gmail-autoresponder
```

### 2️⃣ Install Dependencies
```bash
npm install
```

### 3️⃣ Create `.env` File
```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000

DATABASE_URL="file:./db.sqlite"

OLLAMA_MODEL=llama3
```

### 4️⃣ Start Ollama
```bash
ollama run llama3
```

### 5️⃣ Run Development Server
```bash
npm run dev
```

## 🔍 System Architecture

```
             ┌──────────────────────┐
             │      User Login      │
             │     (Google OAuth)   │
             └───────────┬──────────┘
                         ▼
                ┌─────────────────┐
                │  Gmail API Fetch │
                └───────────┬─────┘
                         ▼
           ┌───────────────────────────┐
           │   Thread + RFC-822 Parser │
           └───────────┬──────────────┘
                         ▼
           ┌───────────────────────────┐
           │    Local LLM (Ollama)     │
           │   Draft Generation Engine │
           └───────────┬──────────────┘
                         ▼
         ┌─────────────────────────────┐
         │ Behavioral Profiling Engine │
         │  + Learn-From-My-Edit Loop  │
         └───────────┬────────────────┘
                         ▼
           ┌──────────────────────────┐
           │  Gmail Draft + Label API │
           └──────────────────────────┘
```

## 🔐 Privacy & Security

- All LLM inference runs locally  
- No email content sent to cloud models  
- Only Gmail API + OAuth used  
- No external telemetry  

## 🗺️ Roadmap

- [ ] Intent classification  
- [ ] Smart signature generation  
- [ ] Gmail UI Chrome Extension  
- [ ] Multi-account mode  
- [ ] Optional auto-send mode  

## 🧑‍💻 Contributing

Contributions are welcome! Submit issues, feature requests, or PRs.

## 📜 License

MIT License.

## ⭐ Support

If you find this project helpful, please ⭐ star the repository!
