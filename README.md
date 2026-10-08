# 💬 Unsaid — Say It Right · Universal Communication Coach

[![Node.js 22](https://img.shields.io/badge/node.js-22+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.7+-blue.svg)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/backend-Express_4.21+-000000.svg)](https://expressjs.com/)
[![Google Gemini](https://img.shields.io/badge/AI-Google_Gemini-4285F4.svg)](https://ai.google.dev/)
[![Privacy](https://img.shields.io/badge/privacy-Zero_Retention-success.svg)](#-zero-retention-privacy--safety)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **"Feel it. Write it. Say it right."**  
> An auditable, privacy-first AI communication coach that empowers users to draft high-stakes messages—to professors, managers, landlords, recruiters, or peers—and teaches them how to communicate with clarity, accountability, and empathy.

---

## 📑 Table of Contents

- [The Problem & Our Mission](#-the-problem--our-mission)
- [Key Features](#-key-features)
- [How It Works: 3-Step Coached Flow](#-how-it-works-3-step-coached-flow)
- [The 5-Dimension Perception Rubric](#-the-5-dimension-perception-rubric)
- [System Architecture](#-system-architecture)
- [Zero-Retention Privacy & Safety](#-zero-retention-privacy--safety)
- [Prerequisites & Installation](#-prerequisites--installation)
- [Quickstart: Running Locally](#-quickstart-running-locally)
- [Supported LLM Providers & Configuration](#-supported-llm-providers--configuration)
  - [Google Gemini (Default & Multi-Model Cascade)](#1-google-gemini-default)
  - [Local Offline Models with Ollama](#2-local-offline-models-with-ollama)
  - [Offline Mock Testing (FakeLLM)](#3-offline-mock-testing-fakellm)
  - [OpenAI & OpenAI-Compatible Endpoints](#4-openai--openai-compatible-endpoints)
  - [Anthropic Claude](#5-anthropic-claude)
- [Testing & Quality Assurance](#-testing--quality-assurance)
- [API Reference](#-api-reference)
- [Docker & Production Deployment](#-docker--production-deployment)
- [Repository Structure](#-repository-structure)
- [License](#-license)

---

## 🎯 The Problem & Our Mission

You need to message a professor about a missed deadline, ask a manager for a schedule adjustment, decline an unreasonable client request, or follow up on an unfairly graded exam. You know what you mean, but not how to say it. One wrong phrase or defensive tone changes the entire outcome:
- **Generic AI rewriters make things worse:** They sanitize your voice into robotic corporate jargon or silently invent fictional excuses (e.g., *"I had a family medical emergency"*).
- **Users don't learn:** Autocompletes and chatbots provide zero feedback on *why* a particular phrase irritates the recipient.

### Our Approach: Teaching Over Paraphrasing
**Unsaid** flips the script:
1. **Objective Diagnostics:** Evaluates the draft against an academic & professional perception rubric.
2. **Named Principles & Actionable Nudges:** Flags problematic phrases (e.g., *"the deadline was unfair"*) and pairs them with specific communication principles (*Own it*, *Lead with the ask*, *Proportionate explanation*).
3. **The Critical Honesty Guard:** Strictly prohibits hallucinating unmentioned reasons. Unsaid checks whether new assumptions were introduced (`new_facts_introduced: []`) and prompts the user to provide context instead of fabricating it.
4. **Self-Revision First:** Students can refine their own words, re-diagnose to see their score climb, and only review the AI rewrite when ready.

---

## 🚀 Key Features

- 🎯 **5-Dimension Perception Rubric:** Evaluates Clarity of the Ask, Accountability, Warmth & Respect, Formality Fit, and Proportion.
- 🛡️ **Critical Honesty Guard:** Tracks assumptions and prevents hallucinated excuses. Academic integrity is preserved by design.
- 🔒 **Zero-Retention Privacy Architecture:** No database. No accounts. Drafts exist only in volatile RAM for the duration of the request. Audits record only SHA-256 hashes and token metrics.
- ⚡ **Real-Time 2-Way Text Highlighting:** Interactive flag cards in the UI synchronize with highlighted phrases in the live draft editor.
- 🎭 **Live Mood & Sentiment Detection:** Dynamic sentiment indicator adapts as the user types.
- 🤖 **Universal & Adaptive Context Engine:** Select any recipient (professor, manager, landlord, partner) and receive dynamically generated, realistic scenario chips.
- 🔄 **Pluggable Multi-LLM Engine:** Seamlessly toggle between Google Gemini, local Ollama models (Qwen, Llama), OpenAI, Anthropic Claude, or an offline `FakeLLM` mock.
- 🎨 **Neobrutalist UI with Dark/Light Theme:** Tactile borders, high contrast, accessible typography, and persistent theme preferences.

---

## 🔄 How It Works: 3-Step Coached Flow

```
┌────────────────────────┐      ┌────────────────────────┐      ┌────────────────────────┐
│   STEP 1: WRITE        │ ──►  │   STEP 2: DIAGNOSE     │ ──►  │   STEP 3: POLISH       │
│                        │      │                        │      │                        │
│ • Enter Recipient      │      │ • 0-100 Tone Score     │      │ • Polished Rewrite     │
│ • Pick/Type Situation  │      │ • 5 Rubric Target Bars │      │ • Side-by-Side Diff    │
│ • Unfiltered Draft     │      │ • Principle Flag Cards │      │ • Honesty Guard Badge  │
│ • Live Sentiment Pill  │      │ • Two-Way Highlights   │      │ • Educational Takeaway │
└────────────────────────┘      └────────────────────────┘      └────────────────────────┘
```

1. **Step 1: Write ("Feel it. Write it.")**
   - The user selects who they are writing to (e.g., Professor, Department Chair, Manager).
   - Adaptive situation chips populate dynamically based on the recipient via `/suggest-situations`.
   - The user types their raw, unfiltered draft. Live sentiment analysis and character counts provide instant guidance.

2. **Step 2: Diagnose ("Tone check. No judgment.")**
   - The backend runs the draft against the versioned rubric template (`prompts/diagnose.v1.md` and `rubrics/professor_ask.v1.yaml`).
   - Generates a **0–100 Overall Score**, individual scores for all 5 dimensions against target zones, and interactive phrase flags.
   - Each flag highlights the exact text snippet and cites a **Communication Principle** and **Actionable Nudge**.
   - The user can edit the text directly to improve their score.

3. **Step 3: Coach & Polish ("Better words. Zero bullshit.")**
   - When requested, the pipeline generates a clean, respectful rewrite.
   - Displays a side-by-side **Diff Inspector** (`From -> To`) explaining *why* each phrase was revised.
   - The **Honesty Guard** audits the rewrite to guarantee no unverified facts or excuses were introduced.
   - Provides a memorable takeaway principle to build long-term communication skills.

---

## 📊 The 5-Dimension Perception Rubric

Every message is scored on a 1–5 scale across five critical dimensions:

| Dimension | Description | Target Range | Example Antipattern | Guided Correction |
|:---|:---|:---:|:---|:---|
| **Clarity of Ask** | How quickly and clearly the recipient understands the specific request. | **4 – 5** | Stating the core request in the third paragraph after lengthy preamble. | *Lead with the ask:* State what you need in the opening sentence. |
| **Accountability** | Taking ownership of deadlines and setbacks without defensive deflection. | **4 – 5** | *"The deadline was unfair because we had other exams."* | *Own it:* Acknowledge the delay objectively without blaming syllabus scheduling. |
| **Warmth & Respect** | Calibrated empathy, appreciation, and consideration for the reader's time. | **3 – 5** | Cold, demanding, or entitled commands (*"I need this solved by today"*). | *Respectful courtesy:* Express appreciation for their time and guidance. |
| **Formality Fit** | Appropriate social and professional distance. | **3 – 4** | Overly casual greetings (*"Hey prof"*) or archaic stiffness (*"Dearest Sir"*). | *Professional address:* Use standard academic/professional salutations. |
| **Proportion** | Matching the message length and emotional weight to the magnitude of the ask. | **3 – 4** | Excessive apologies, catastrophic language, or multiple rambling paragraphs. | *Proportionate explanation:* Keep explanations concise; offer to share details if needed. |

### Deterministic Score Calculation
The overall score (0–100) is deterministically calculated by measuring how close each dimension's score $v$ is to its calibrated target band $[t_{\min}, t_{\max}]$:
$$\text{closeness} = \begin{cases} 1.0 & \text{if } t_{\min} \le v \le t_{\max} \\ \max\left(0.0, 1.0 - \frac{t_{\min} - v}{4.0}\right) & \text{if } v < t_{\min} \\ \max\left(0.0, 1.0 - \frac{v - t_{\max}}{4.0}\right) & \text{if } v > t_{\max} \end{cases}$$
$$\text{Overall Score} = \text{round}\left(100 \times \frac{\sum \text{closeness}}{5}\right)$$

---

## 🏗️ System Architecture

```
[Browser Client: index.html + Vanilla JS]
       │
       │ HTTP POST (/suggest-situations, /context, /diagnose, /rewrite)
       ▼
[FastAPI Application (app/main.py)]
   ├── Rate Limiter (Sliding Window in RAM)
   ├── Safety & Crisis Evaluator (app/safety.py)
   └── Dependency Injection Layer (Settings, LLMClient, Pipeline)
       │
       ▼
[Orchestration Pipeline (app/pipeline.py)]
   ├── Prompts Loader (prompts/*.md)
   ├── Rubric Loader (rubrics/*.yaml)
   ├── Resilient JSON Sanitizer & Pydantic Schema Validator
   └── Retry & Error Handler
       │
       ▼
[Pluggable LLM Layer (app/llm.py)]
   ├── Google Gemini (Direct SDK with Fallback Cascade)
   ├── Ollama (Local JSON /api/chat)
   ├── OpenAI & Compatible (Direct httpx)
   ├── Anthropic Claude (Direct httpx)
   └── FakeLLM (Deterministic offline engine)
       │
       ▼
[Audit Logging (app/audit.py)]
   └── Outputs structured JSON to stdout:
       { "timestamp", "request_id", "input_sha256", "scores", "latency_ms" }
       (Raw draft text is NEVER printed or logged)
```

---

## 🔒 Zero-Retention Privacy & Safety

Communication during high-stakes moments often involves personal disclosures, health challenges, or raw emotional vulnerability. **Unsaid** is built around strict data sovereignty:

1. **No Database & No Accounts:**
   The repository does not contain SQLite, Postgres, Redis, or Mongo connections. Requests are processed in volatile memory and immediately discarded after response generation.
2. **Cryptographic SHA-256 Audit Logs:**
   In [app/audit.py](file:///d:/Hackathon/Hack/app/audit.py), inbound drafts are converted to a one-way SHA-256 hash (`hash_text()`) for rate-limiting and auditability. The plaintext draft is **never** printed to stdout or logged to files.
3. **Safety & Crisis Interventions:**
   In [app/safety.py](file:///d:/Hackathon/Hack/app/safety.py):
   - **Threat Filters:** Blocks abusive, threatening, or extortionist language with a polite refusal.
   - **Crisis & Distress Signals:** Automatically intercepts mentions of self-harm or acute distress, providing supportive messaging and directing users to university counseling centers and crisis resources.

---

## 💻 Prerequisites & Installation

### 1. Prerequisites
- **Python 3.12+**
- Git (optional)
- (Optional) [Ollama](https://ollama.com/) if running fully local, offline AI models

### 2. Setup Virtual Environment

#### On Windows (PowerShell):
```powershell
# Navigate to project directory
cd d:\Hackathon\Hack

# Create virtual environment
python -m venv .venv

# Activate virtual environment
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt
```

#### On Linux / macOS:
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Configure Environment Variables
Copy the example environment configuration:
```bash
cp .env.example .env
```

Edit `.env` to select your preferred provider and credentials:
```env
# Default: Google Gemini
LLM_PROVIDER=gemini
LLM_MODEL=gemini-3.1-flash-lite
LLM_API_KEY=your_gemini_api_key_here
LLM_FALLBACK_MODELS=gemini-3.5-flash,gemini-3.6-flash

# Limits & Server
MIN_DRAFT_CHARS=15
MAX_DRAFT_CHARS=3000
RATE_LIMIT_PER_MIN=60
PORT=8000
HOST=0.0.0.0
ENVIRONMENT=development
```

---

## ⚡ Quickstart: Running Locally

Launch the local development server with auto-reload:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Once running, access the application in your browser:
- **Interactive Web App:** [http://localhost:8000](http://localhost:8000)
- **Interactive Swagger API Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Alternative ReDoc Docs:** [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Server Health Check:** [http://localhost:8000/health](http://localhost:8000/health)

---

## 🔌 Supported LLM Providers & Configuration

Unsaid supports zero-dependency model swapping via configuration.

### 1. Google Gemini (Default)
Configured using Google's official `google-genai` SDK. Includes an automatic fallback cascade to guarantee uninterrupted service if rate limits or quota boundaries are met:
```env
LLM_PROVIDER=gemini
LLM_MODEL=gemini-3.1-flash-lite
LLM_FALLBACK_MODELS=gemini-3.5-flash,gemini-3.6-flash
LLM_API_KEY=your_gemini_api_key
```

### 2. Local Offline Models with Ollama
Run 100% offline with zero API fees and complete data privacy:
```bash
# Pull your desired model
ollama pull qwen3.5:latest
```
In `.env`:
```env
LLM_PROVIDER=ollama
LLM_MODEL=qwen3.5:latest
LLM_BASE_URL=http://localhost:11434
```

### 3. Offline Mock Testing (FakeLLM)
For automated testing, CI/CD pipelines, or offline demonstrations with zero internet:
```env
LLM_PROVIDER=fake
LLM_MODEL=fake-evaluator
```

### 4. OpenAI & OpenAI-Compatible Endpoints
Supports OpenAI, Groq, Together AI, or vLLM:
```env
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini
LLM_API_KEY=sk-proj-...
# For Groq / Together / vLLM:
# LLM_PROVIDER=openai_compat
# LLM_BASE_URL=https://api.groq.com/openai/v1
```

### 5. Anthropic Claude
```env
LLM_PROVIDER=anthropic
LLM_MODEL=claude-3-5-sonnet-20241022
LLM_API_KEY=sk-ant-...
```

---

## 🧪 Testing & Quality Assurance

### Run Unit and API Tests
```bash
pytest -v
```
Tests cover:
- Endpoint health and schema validation (`tests/test_api.py`).
- Length constraints and whitespace rejection.
- Safety refusal patterns and crisis interventions.
- Deterministic privacy hashing (verifying raw drafts are never leaked to stdout).
- Ollama client formatting and generation.

### Run Golden Regression Evaluation Benchmark
To test diagnostic accuracy and latency against the golden regression dataset:
```bash
# Run against the offline fake provider
python evals/run_evals.py --provider fake

# Or evaluate against live Gemini models
python evals/run_evals.py --provider gemini --model gemini-3.1-flash-lite
```

### Live End-to-End Pipeline Sanity Check
With the local server running, verify all HTTP endpoints end-to-end:
```bash
python tests/test_live_flow.py
```

---

## 📖 API Reference

### 1. `GET /health`
Returns current server status, active provider, and environment.
```json
{
  "status": "ok",
  "provider": "gemini",
  "model": "gemini-3.1-flash-lite",
  "environment": "development"
}
```

### 2. `POST /suggest-situations`
Generates context-aware situation chips for a given recipient.
* **Request:** `{"recipient": "Apartment Landlord"}`
* **Response:**
  ```json
  {
    "recipient": "Apartment Landlord",
    "situations": [
      "Disputing Deposit Deduction",
      "Requesting Urgent Maintenance",
      "Notice of Lease Termination",
      "Addressing Noise Complaints"
    ]
  }
  ```

### 3. `POST /context`
Normalizes context, infers relationship power dynamics, and checks safety.
* **Request:**
  ```json
  {
    "draft": "Hey prof, I need extra time for the lab.",
    "recipient": "Professor",
    "situation": "Requesting a deadline extension"
  }
  ```
* **Response:**
  ```json
  {
    "request_id": "a8f3b9c1",
    "status": "ok",
    "scene": {
      "relationship": "superior",
      "power": "recipient_higher",
      "closeness": "distant",
      "intent": "request",
      "stakes": "medium",
      "channel": "email",
      "summary": "Writing to Professor regarding Requesting a deadline extension."
    }
  }
  ```

### 4. `POST /diagnose`
Evaluates the draft against the rubric and returns scores, dimensions, and flagged phrases.
* **Request:**
  ```json
  {
    "draft": "Hey prof, the deadline was unfair because I was overwhelmed. Can I get an extension?",
    "recipient": "Professor",
    "situation": "Deadline extension"
  }
  ```
* **Response (Excerpt):**
  ```json
  {
    "request_id": "9d82e14a",
    "verdict": "Reads as hurried and defensive.",
    "overall": 45,
    "scores": {
      "clarity": {"value": 3, "target_min": 4, "target_max": 5},
      "accountability": {"value": 2, "target_min": 4, "target_max": 5},
      "warmth": {"value": 3, "target_min": 3, "target_max": 5},
      "formality": {"value": 2, "target_min": 3, "target_max": 4},
      "proportion": {"value": 3, "target_min": 3, "target_max": 4}
    },
    "flags": [
      {
        "text": "the deadline was unfair",
        "reason": "Blaming the course structure deflects personal accountability.",
        "principle": "Own it",
        "nudge": "Explain the setback without attacking the syllabus schedule.",
        "dimension_id": "accountability"
      }
    ]
  }
  ```

### 5. `POST /rewrite`
Generates a polished rewrite, side-by-side diffs, takeaways, and honesty audit.
* **Request:**
  ```json
  {
    "draft": "Hey prof, the deadline was unfair. Can I get extra time?",
    "recipient": "Professor",
    "situation": "Deadline extension"
  }
  ```
* **Response:**
  ```json
  {
    "request_id": "5b4c1029",
    "rewrite": "Dear Professor [Last Name],\n\nI am writing to respectfully request a 48-hour extension on Assignment 2. I experienced an unforeseen setback this week and want to ensure my submission meets course standards. I can submit the complete draft by Friday at 5:00 PM.\n\nThank you for your time and understanding.\n\nSincerely,\n[Your Name]",
    "changes": [
      {
        "from": "the deadline was unfair",
        "to": "experienced an unforeseen setback",
        "reason": "Eliminates defensive blame and demonstrates maturity.",
        "principle": "Own it"
      }
    ],
    "takeaway": "Lead with the exact request and proposed submission timeline in your first sentence.",
    "new_facts_introduced": []
  }
  ```

---

## 🐳 Docker & Production Deployment

### Build and Run with Docker
```bash
# Build the container image
docker build -t unsaid .

# Run container on port 8000
docker run -p 8000:8000 --env-file .env unsaid
```

### Deploy to Google Cloud Run
```bash
gcloud run deploy unsaid \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars LLM_PROVIDER=gemini,LLM_MODEL=gemini-3.1-flash-lite \
  --set-secrets LLM_API_KEY=gemini-api-key:latest
```

---

## 📁 Repository Structure

```
Unsaid/
├── app/
│   └── static/              # Neobrutalist web interface
│       ├── index.html       # Single-page UI shell
│       ├── styles.css       # Neobrutalist design system & dark/light theme
│       └── app.js           # Interactive application controller
├── prompts/
│   ├── diagnose.v1.md       # Versioned diagnostic evaluation prompt
│   └── rewrite.v1.md        # Versioned coached rewrite & honesty guard prompt
├── rubrics/
│   └── professor_ask.v1.yaml# 5-Dimension rubric specifications and target thresholds
├── evals/
│   └── golden.json          # Curated benchmark dataset of emails & tests
├── docs/
│   └── decisions.md         # Architecture and design rationale records (ADRs)
├── server.ts                # TypeScript server, API endpoints, rate limiter & AI coaching
├── package.json             # Node.js dependencies and run scripts
├── tsconfig.json            # TypeScript compiler configuration
├── Dockerfile               # Minimal, hardened, non-root container image (Node.js 22)
├── .env.example             # Documented environment template
├── LICENSE                  # MIT License
└── README.md                # Project documentation
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
