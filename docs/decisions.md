# Say It Right — Architecture & Design Decisions

This document records key technical, security, and design choices made during development.

---

### 1. Niche Choice: First-Year Students Communicating with Professors
* **Context:** Generic text rewriters produce sterile, generic emails and fail to address student anxiety or relationship dynamics.
* **Decision:** Specialize exclusively on high-stakes academic communication (extensions, grade questions, missed deadlines).
* **Consequence:** Concrete rubrics with named academic principles (e.g., *Lead with the ask*, *Own it*, *Academic address*) provide actionable coaching rather than mere paraphrasing.

---

### 2. Zero-Retention Privacy Stance (No Database, No Accounts)
* **Context:** Student drafts may contain sensitive personal disclosures, medical notes, or raw emotional state.
* **Decision:** Do not implement a database, user accounts, or persistent disk storage for drafts.
* **Auditability:** Log structured JSON to stdout containing SHA-256 hashes of input texts, latency, token usage, and diagnostic scores, but **never the raw text**.
* **Benefit:** Maximum privacy, zero GDPR/FERPA liability, and minimal attack surface.

---

### 3. Direct Swappable LLM Protocol (No Heavy Vendor SDKs)
* **Context:** Integrating proprietary SDKs (e.g., `openai`, `google-generativeai`, `anthropic`) introduces heavy dependencies, binary wheels, and potential breaking version mismatches.
* **Decision:** Implement a clean `LLMClient` protocol with lightweight `httpx` adapters.
* **Benefit:** Swapping between Anthropic Claude, OpenAI, Gemini, or local models (Ollama, vLLM via `openai_compat`) requires only changing environment variables (`LLM_PROVIDER`, `LLM_MODEL`, `LLM_API_KEY`, `LLM_BASE_URL`).

---

### 4. Pydantic Schema Validation with Automated Repair Retry
* **Context:** LLMs occasionally wrap JSON in explanatory text or markdown code fences (` ```json `).
* **Decision:** Clean markdown fences and parse responses into strict Pydantic models. On first parse failure, execute a single targeted retry requesting JSON correction before failing.
* **Benefit:** Guaranteed type safety on all downstream endpoints and zero crashes on bad model syntax.

---

### 5. Honesty Guard & Hallucination Prevention
* **Context:** Automated rewriters often invent fictional excuses (e.g., "I had a sudden family emergency").
* **Decision:** Require the rewrite prompt to return a `new_facts_introduced` array and bracket unfilled reasons. If unverified details appear, the UI warns the user.
* **Benefit:** Prevents students from inadvertently sending dishonest excuses to faculty.
