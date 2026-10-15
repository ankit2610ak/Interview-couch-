# 🎙️ AI Interview Coach

An AI-powered mock interview application that conducts technical interviews, gives real-time feedback, and stores your session history — powered by **Groq LLM**, **FastAPI**, and **Next.js**.

[![Live Demo](https://img.shields.io/badge/Demo-interview--couch.vercel.app-blueviolet?style=for-the-badge&logo=vercel)](https://interview-couch.vercel.app)
[![API Status](https://img.shields.io/badge/API-Render-brightgreen?style=for-the-badge&logo=render)](https://interview-couch-api.onrender.com)

![Tech Stack](https://img.shields.io/badge/stack-FastAPI%20%7C%20Next.js%20%7C%20Groq-blue?style=flat-square)
![Python](https://img.shields.io/badge/python-3.11%2B-brightgreen?style=flat-square)
![Node](https://img.shields.io/badge/node-18%2B-brightgreen?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-orange?style=flat-square)

🌐 **Live Application:** [https://interview-couch.vercel.app](https://interview-couch.vercel.app)  
⚡ **Production Backend API:** [https://interview-couch-api.onrender.com](https://interview-couch-api.onrender.com)

---

## ✨ Features

- 🤖 **AI-Powered Interviewer** — realistic multi-turn interview conversations via Groq LLM
- 🎯 **Topic & Difficulty Selection** — customise by topic and level (Easy / Medium / Hard)
- 📊 **Detailed Reports** — AI-generated performance reports with scores and feedback
- 📚 **Interview History** — review all past sessions from the left drawer
- 🌐 **Offline Detection** — clear error shown when internet is unavailable
- 🔁 **Auto-Retry** — automatic retry with visible progress on transient failures

---

## 🏗️ Architecture Overview

```
┌──────────────────────────────────────────────────┐
│                  Client Browser                  │
│                                                  │
│  ┌─────────────────┐    ┌─────────────────────┐  │
│  │   Home Page     │───▶│   Interview Page    │  │
│  │  (topic setup)  │    │  (multi-turn chat)  │  │
│  └─────────────────┘    └──────────┬──────────┘  │
│                                    │              │
│                          ┌─────────▼──────────┐  │
│                          │    Report Page      │  │
│                          │ (score + feedback)  │  │
│                          └────────────────────-┘  │
└────────────────────┬─────────────────────────────┘
                     │  REST API (JSON/HTTPS)
                     │
┌────────────────────▼─────────────────────────────┐
│               FastAPI Backend                    │
│                                                  │
│  POST /api/interview/start                       │
│  POST /api/interview/answer                      │
│  POST /api/report/generate                       │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │             LLM Service                    │  │
│  │  (Groq client · prompt engineering)        │  │
│  └───────────────────┬────────────────────────┘  │
└──────────────────────┼───────────────────────────┘
                       │  HTTPS
                       │
            ┌──────────▼──────────┐
            │   Groq Cloud API    │
            │  llama-3.3-70b      │
            └─────────────────────┘
```

---

## 🔄 Flow Diagram

```mermaid
flowchart TD
    A([User opens app]) --> B[Fill topic & difficulty]
    B --> C{Internet available?}
    C -- No --> D[Show: No internet connection]
    D --> B
    C -- Yes --> E[POST /api/interview/start]
    E --> F{API success?}
    F -- No retrying --> G[Show retry status]
    G --> E
    F -- No failed --> H[Show friendly error + Retry button]
    H --> B
    F -- Yes --> I[Navigate to Interview page]
    I --> J[AI asks first question]
    J --> K[User types answer]
    K --> L[POST /api/interview/answer]
    L --> M{More questions?}
    M -- Yes --> N[AI asks next question]
    N --> K
    M -- No --> O[POST /api/report/generate]
    O --> P[Navigate to Report page]
    P --> Q[Display score & feedback]
    Q --> R[Session saved to History]
    R --> S([User reviews or restarts])
```

---

## 👤 Use Case Diagram

```mermaid
graph LR
    subgraph User
        UC1([Start Interview])
        UC2([Answer Questions])
        UC3([View Report])
        UC4([Browse History])
        UC5([Retry on Error])
    end

    subgraph System
        S1[Validate Input]
        S2[Check Connectivity]
        S3[Call Groq LLM]
        S4[Parse AI Response]
        S5[Generate Report]
        S6[Persist Session Locally]
        S7[Load History]
    end

    UC1 --> S1
    S1 --> S2
    S2 --> S3
    S3 --> S4
    S4 --> UC2
    UC2 --> S3
    UC2 --> S5
    S5 --> UC3
    S5 --> S6
    UC4 --> S7
    UC5 --> S2
```

---

## 🧩 Class Diagram

```mermaid
classDiagram
    class InterviewStartRequest {
        +str topic
        +str difficulty
    }

    class AnswerRequest {
        +str answer
        +list conversation_history
        +str topic
        +str difficulty
    }

    class ReportRequest {
        +list conversation_history
        +str topic
        +str difficulty
    }

    class InterviewStartResponse {
        +str first_message
        +list conversation_history
    }

    class AnswerResponse {
        +str message
        +list conversation_history
        +bool is_complete
    }

    class ReportResponse {
        +int score
        +str summary
        +list strengths
        +list improvements
        +str recommendation
    }

    class LLMService {
        -str api_key
        -str model
        -Groq client
        +start_interview(topic, difficulty)
        +get_next_interviewer_message(history, topic, difficulty)
        +generate_interview_report(history, topic, difficulty)
    }

    class InterviewRouter {
        +POST /start()
        +POST /answer()
    }

    class ReportRouter {
        +POST /generate()
    }

    class HistoryStorage {
        +saveSession(session)
        +getSessions()
        +deleteSession(id)
        +clearAll()
    }

    class InterviewSession {
        +str id
        +str topic
        +str difficulty
        +int score
        +str summary
        +Date date
        +list strengths
        +list improvements
    }

    InterviewRouter --> LLMService : uses
    ReportRouter --> LLMService : uses
    LLMService --> InterviewStartResponse : returns
    LLMService --> AnswerResponse : returns
    LLMService --> ReportResponse : returns
    InterviewRouter ..> InterviewStartRequest : receives
    InterviewRouter ..> AnswerRequest : receives
    ReportRouter ..> ReportRequest : receives
    HistoryStorage --> InterviewSession : manages
```

---

## 📁 Project Structure

```
Interview-couch-/
├── backend/
│   ├── .env.example          # Environment variable template
│   ├── main.py               # FastAPI app entry point
│   ├── schemas.py            # Request / response models
│   ├── requirements.txt
│   ├── routers/
│   │   ├── interview.py      # /api/interview endpoints
│   │   └── report.py         # /api/report endpoint
│   ├── services/
│   │   └── llm_service.py    # Groq LLM integration
│   └── tests/
│       ├── unit/
│       └── integration/
│
└── frontend/
    ├── .env.local.example    # Environment variable template
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx          # Home — topic & difficulty setup
    │   │   ├── interview/        # Multi-turn interview chat
    │   │   └── report/           # Performance report
    │   ├── components/
    │   │   └── history-drawer.tsx
    │   └── lib/
    │       ├── network.ts         # Retry + offline detection
    │       └── history-storage.ts # localStorage persistence
    └── package.json
```

---

## 🚀 Getting Started

### Prerequisites

| Tool | Min Version |
|------|------------|
| Python | 3.11+ |
| Node.js | 18+ |
| npm | 9+ |
| Groq API Key | [Get free key →](https://console.groq.com/keys) |

### 1. Clone

```bash
git clone https://github.com/ankit2610ak/Interview-couch-.git
cd Interview-couch-
```

### 2. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Open .env and set your GROQ_API_KEY

uvicorn main:app --reload --port 8000
```

API running at **http://localhost:8000**

### 3. Frontend *(new terminal)*

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

App running at **http://localhost:3000** 🎉

---

## 🔑 Environment Variables

### `backend/.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | ✅ | Groq API key — [console.groq.com/keys](https://console.groq.com/keys) |
| `GROQ_MODEL` | ❌ | Model name (default: `openai/gpt-oss-120b`) |
| `CORS_ORIGINS` | ❌ | Comma-separated allowed frontend origins |

### `frontend/.env.local`

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | ❌ | Backend URL (default: `http://localhost:8000`) |

---

## ☁️ Deployment

### Production Setup: Vercel + Render (Free Tier)

**Backend → Render (Web Service)**
1. Go to [dashboard.render.com](https://dashboard.render.com) → **New** → **Web Service**
2. Connect your GitHub repository `ankit2610ak/Interview-couch-`
3. Configure settings:
   - **Root Directory:** `backend`
   - **Environment:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. In **Environment Variables**, add:
   - `GROQ_API_KEY` = your Groq API key
   - `GROQ_MODEL` = `openai/gpt-oss-120b`

**Frontend → Vercel**
1. Go to [vercel.com](https://vercel.com) → **Add New** → **Project** → Import `ankit2610ak/Interview-couch-`
2. Set **Root Directory** to `frontend`
3. In **Environment Variables**, add:
   - `NEXT_PUBLIC_API_URL` = your Render backend URL (e.g., `https://interview-couch-api.onrender.com`)
   - Type: **Config** (not Secret)
4. Click **Deploy**

---

## 🤝 Contributing

1. Fork the repo and create a branch: `git checkout -b feature/my-feature`
2. Commit your changes: `git commit -m "feat: description"`
3. Push and open a Pull Request

---

## 📄 License

MIT © 2024
