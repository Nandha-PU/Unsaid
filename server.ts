import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import yaml from 'yaml';
import { GoogleGenAI } from '@google/genai';

// Determine environment
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';

// API Key handling
const apiKey = process.env.GEMINI_API_KEY || process.env.LLM_API_KEY || '';

// Initialize Google GenAI client if key is available
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

const app = express();

// Security and CORS middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));

// Sliding window in-memory rate limiter
const ipRequests = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = parseInt(process.env.RATE_LIMIT_PER_MIN || '60', 10);

function checkRateLimit(req: Request, res: Response, next: () => void) {
  const forwarded = req.headers['x-forwarded-for'];
  const clientIp = typeof forwarded === 'string'
    ? forwarded.split(',')[0].trim()
    : req.socket.remoteAddress || 'unknown';

  const now = Date.now();
  const timestamps = (ipRequests.get(clientIp) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);

  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({
      error: {
        code: 'rate_limited',
        message: 'Rate limit exceeded. Please wait a minute before analyzing another draft.',
      },
    });
  }

  timestamps.push(now);
  ipRequests.set(clientIp, timestamps);
  next();
}

// Safety Evaluation Logic
const THREAT_PATTERN = /\b(kill\s+you|bomb|destroy\s+your\s+life|harm\s+you|blackmail|leak\s+your\s+address|hunt\s+you\s+down|ruin\s+you)\b/i;
const CRISIS_PATTERN = /\b(suicide|end\s+my\s+life|kill\s+myself|hurting?\s+myself|self[\s-]harm)\b/i;

function evaluateSafety(text: string): { status: 'ok' | 'refused' | 'crisis'; message?: string } {
  if (!text) return { status: 'ok' };
  const clean = text.trim();
  if (THREAT_PATTERN.test(clean)) {
    return {
      status: 'refused',
      message: 'Your draft contains threatening or abusive language, which violates our communication policies. Please rephrase respectfully to receive guidance.',
    };
  }
  if (CRISIS_PATTERN.test(clean)) {
    return {
      status: 'crisis',
      message: 'You may be experiencing intense distress. Academic and personal stress is real, but your wellbeing comes first. Please reach out to your campus counseling center or a local support helpline.',
    };
  }
  return { status: 'ok' };
}

// Load Rubric and Prompts
const rubricPath = path.resolve('rubrics', 'professor_ask.v1.yaml');
let rubricData: any = {};
try {
  if (fs.existsSync(rubricPath)) {
    rubricData = yaml.parse(fs.readFileSync(rubricPath, 'utf-8'));
  }
} catch (e) {
  console.warn('Could not parse rubric YAML:', e);
}

const diagnosePromptPath = path.resolve('prompts', 'diagnose.v1.md');
const rewritePromptPath = path.resolve('prompts', 'rewrite.v1.md');
const diagnosePromptTmpl = fs.existsSync(diagnosePromptPath)
  ? fs.readFileSync(diagnosePromptPath, 'utf-8')
  : '';
const rewritePromptTmpl = fs.existsSync(rewritePromptPath)
  ? fs.readFileSync(rewritePromptPath, 'utf-8')
  : '';

// Privacy-First Audit Logger (Zero Raw Draft Retention)
function logAudit(record: Record<string, any>) {
  const line = {
    timestamp: new Date().toISOString(),
    ...record,
  };
  process.stdout.write(JSON.stringify(line) + '\n');
}

function hashText(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf-8').digest('hex');
}

// Clean JSON response from LLM
function cleanJsonText(raw: string): string {
  let clean = raw.trim();
  const fenceMatch = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) {
    clean = fenceMatch[1].trim();
  }
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end >= start) {
    clean = clean.slice(start, end + 1);
  }
  return clean;
}

// Offline Mock LLM Fallbacks
function generateMockDiagnose(draft: string) {
  const flagList = [];
  const lower = draft.toLowerCase();

  if (lower.includes('unfair')) {
    flagList.push({
      text: 'unfair',
      reason: 'Blaming the timeline or expectations reads as defensive and deflects personal responsibility.',
      principle: 'Own it',
      nudge: 'Describe the specific obstacle objectively instead of critiquing the schedule or rules.',
      dimension_id: 'accountability',
    });
  }
  if (lower.includes('hey prof') || lower.includes('hey ') || lower.startsWith('hey')) {
    const phrase = lower.includes('hey prof') ? 'hey prof' : 'hey';
    flagList.push({
      text: phrase,
      reason: 'Overly casual greeting can be perceived as lacking respect for the recipient.',
      principle: 'Respectful address',
      nudge: "Use 'Dear [Name],' or 'Hello [Name],'.",
      dimension_id: 'formality',
    });
  }

  if (flagList.length === 0) {
    const firstWords = draft.split('\n')[0].slice(0, 30).trim() || 'my situation';
    flagList.push({
      text: firstWords,
      reason: 'Could state your specific proposed next steps more directly upfront.',
      principle: 'Lead with the ask',
      nudge: 'Specify your proposed resolution or request clearly in the opening.',
      dimension_id: 'clarity',
    });
  }

  return {
    verdict: 'The recipient may read this draft as somewhat hurried and informal.',
    scores: {
      clarity: { value: 3, target_min: 4, target_max: 5 },
      accountability: { value: 3, target_min: 4, target_max: 5 },
      warmth: { value: 3, target_min: 3, target_max: 5 },
      formality: { value: 2, target_min: 3, target_max: 4 },
      proportion: { value: 3, target_min: 3, target_max: 4 },
    },
    flags: flagList,
  };
}

function generateMockRewrite(recipient: string, situation: string) {
  return {
    rewrite: `Dear ${recipient || 'Manager'},\n\nI am writing to respectfully discuss ${situation.toLowerCase() || 'our current project timeline'}. I encountered an unforeseen constraint and want to ensure my deliverable meets our highest standards.\n\nI have attached my current progress and propose submitting the completed work by Friday at 5:00 PM. Thank you very much for your time and guidance.\n\nSincerely,\n[Your Name]`,
    changes: [
      {
        from: 'can I get extra time',
        to: 'respectfully discuss our project timeline',
        reason: 'Clarifies the exact timeframe upfront and demonstrates professionalism.',
        principle: 'Lead with the ask',
      },
      {
        from: 'unfair deadline',
        to: 'unforeseen constraint',
        reason: 'Eliminates defensive blame and demonstrates accountability.',
        principle: 'Own it',
      },
    ],
    takeaway: 'State the ask and target submission date clearly in your opening paragraph.',
    new_facts_introduced: [],
  };
}

// -----------------------------------------------------------------------------
// ROUTES
// -----------------------------------------------------------------------------

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    provider: ai ? 'gemini' : 'fake',
    model: 'gemini-3.1-flash-lite',
    environment: process.env.ENVIRONMENT || 'production',
  });
});

app.get('/models', (req, res) => {
  res.json({
    models: ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-3.8-flash', 'fake'],
    active: 'gemini-3.1-flash-lite',
    provider: ai ? 'gemini' : 'fake',
  });
});

app.post('/model', (req, res) => {
  const chosen = (req.body?.model || '').trim();
  res.json({
    status: 'ok',
    provider: chosen === 'fake' || !ai ? 'fake' : 'gemini',
    model: chosen || 'gemini-3.1-flash-lite',
  });
});

app.post('/suggest-situations', async (req, res) => {
  const recipient = (req.body?.recipient || '').trim();
  if (!recipient) {
    return res.json({ recipient: '', situations: [] });
  }

  const safety = evaluateSafety(recipient);
  if (safety.status === 'refused') {
    return res.json({
      recipient: 'Colleague',
      situations: [
        'Clarifying Professional Expectations',
        'Requesting Formal Meeting',
        'Aligning on Project Scope',
      ],
    });
  }

  const modelOverride = req.body?.model;
  const isMock = modelOverride === 'fake' || !ai;

  if (isMock) {
    return res.json({
      recipient,
      situations: [
        `Clarifying expectations with ${recipient}`,
        `Requesting urgent feedback from ${recipient}`,
        'Addressing an unresolved dispute',
        'Setting a firm personal boundary',
        'Negotiating terms or timeline',
        'Delivering unexpected news politely',
      ],
    });
  }

  try {
    const prompt = `You are an expert communication coach. A user needs to write a delicate, high-stakes message to: '${recipient}'.
Generate 5 to 6 realistic, specific, and common high-stakes communication situations someone faces when messaging this specific person.
Each situation MUST be a concise phrase of 2 to 6 words (e.g., 'Addressing Micromanagement', 'Requesting Extension', 'Disputing Deposit Deduction', 'Setting Personal Boundaries').
Return ONLY a valid JSON array of strings, for example:
["Situation 1", "Situation 2", "Situation 3", "Situation 4", "Situation 5"]`;

    const modelName = modelOverride && modelOverride.startsWith('gemini')
      ? modelOverride
      : 'gemini-3.1-flash-lite';

    const resp = await ai!.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: 'You are an expert communication coach. You MUST respond with ONLY a valid, parseable JSON array of strings.',
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    });

    const parsed = JSON.parse(resp.text?.trim() || '[]');
    if (Array.isArray(parsed) && parsed.length > 0) {
      return res.json({
        recipient,
        situations: parsed.slice(0, 6).map((s: any) => String(s).trim()),
      });
    }
  } catch (err) {
    console.warn('Error generating dynamic situations via Gemini:', err);
  }

  return res.json({
    recipient,
    situations: [
      'Setting a Firm Boundary',
      'Delivering Unexpected News',
      'Clarifying a Misunderstanding',
      'Requesting Timeline Adjustment',
      'Polite But Resolute Refusal',
      'Addressing Unfair Expectations',
    ],
  });
});

app.get('/meta', (req, res) => {
  res.json({
    relationship: [
      { id: 'superior', label: 'Someone senior to me (Manager / Professor / Department Chair)' },
      { id: 'client', label: 'External Client / Partner' },
      { id: 'ta', label: 'Teaching Assistant (TA)' },
      { id: 'advisor', label: 'Academic Advisor / Counselor' },
      { id: 'peer', label: 'A peer, colleague, or project partner' },
      { id: 'landlord', label: 'Landlord / Service Provider' },
    ],
    power: [
      { id: 'recipient_higher', label: 'They have more power than me' },
      { id: 'equal', label: 'Equal power dynamic' },
      { id: 'sender_higher', label: 'I have more power' },
    ],
    closeness: [
      { id: 'distant', label: 'We are not close / formal acquaintance' },
      { id: 'moderate', label: 'We interact occasionally' },
      { id: 'close', label: 'We know each other well' },
    ],
    intent: [
      { id: 'request', label: 'Asking for something (deadline extension, extra help, raise)' },
      { id: 'query', label: 'Questioning or clarifying a grade, score, or decision' },
      { id: 'apology', label: 'Explaining a delay / apology' },
      { id: 'dispute', label: 'Politely disputing an assessment or policy issue' },
      { id: 'boundary', label: 'Setting a firm boundary or declining respectfully' },
    ],
    stakes: [
      { id: 'low', label: 'Low stakes' },
      { id: 'medium', label: 'Medium stakes' },
      { id: 'high', label: 'High stakes (affects career, grade, or relationship standing)' },
    ],
    channel: [
      { id: 'email', label: 'Formal Email' },
      { id: 'slack', label: 'Slack / Teams / Direct Message' },
      { id: 'lms', label: 'Canvas / Course Portal' },
    ],
  });
});

app.post('/context', (req, res) => {
  const draft = (req.body?.draft || '').trim();
  const recVal = (req.body?.recipient || '').trim();
  const sitVal = (req.body?.situation || '').trim();

  const safety = evaluateSafety(draft);
  if (safety.status === 'refused') {
    return res.json({
      request_id: crypto.randomUUID().slice(0, 8),
      prompt_version: 'context.v1',
      status: 'refused',
      message: safety.message || 'Your message contains abusive phrasing. Please rephrase respectfully to receive guidance.',
    });
  }
  if (safety.status === 'crisis') {
    return res.json({
      request_id: crypto.randomUUID().slice(0, 8),
      prompt_version: 'context.v1',
      status: 'sensitive',
      message: safety.message || 'You may be experiencing intense distress. Academic and personal stress is real, but your wellbeing comes first. Support resources are available to help you.',
    });
  }

  const draftLower = draft.toLowerCase();
  let rel = 'superior';
  if (/ta|assistant/i.test(recVal)) rel = 'ta';
  else if (/advisor|counselor/i.test(recVal)) rel = 'advisor';
  else if (/peer|classmate|colleague/i.test(recVal)) rel = 'peer';
  else if (/landlord/i.test(recVal)) rel = 'landlord';
  else if (/client/i.test(recVal)) rel = 'client';

  let intent = 'request';
  if (/(grade|mark|score|rubric|test|midterm|final|review|salary)/i.test(draftLower) || /(grade|mark|salary|review)/i.test(sitVal)) {
    intent = 'query';
  } else if (/(late|missed|deadline passed|apologize|sorry)/i.test(draftLower) || /(delay|missed|late)/i.test(sitVal)) {
    intent = 'apology';
  } else if (/(boundary|no|cannot|decline|unable|overwhelmed)/i.test(draftLower) || /(boundary|pushing back)/i.test(sitVal)) {
    intent = 'boundary';
  }

  const rDisplay = recVal || 'your recipient';
  const sDisplay = sitVal || 'an important request or inquiry';

  return res.json({
    request_id: crypto.randomUUID().slice(0, 8),
    prompt_version: 'context.v1',
    status: 'ok',
    scene: {
      relationship: rel,
      power: rel === 'peer' ? 'equal' : 'recipient_higher',
      closeness: 'distant',
      intent,
      stakes: /(fail|drop|final|graduation|fired|lease|eviction)/i.test(draftLower) ? 'high' : 'medium',
      channel: 'email',
      summary: `Writing to ${rDisplay} regarding ${sDisplay}.`,
    },
  });
});

app.post('/diagnose', checkRateLimit, async (req, res) => {
  const start = performance.now();
  const draft = (req.body?.draft || '').trim();
  const recipient = (req.body?.recipient || 'Manager').trim();
  const situation = (req.body?.situation || 'General request').trim();
  const modelOverride = req.body?.model;

  if (draft.length < 15) {
    return res.status(422).json({
      error: { code: 'invalid_input', message: 'Draft must be at least 15 characters.' },
    });
  }

  const safety = evaluateSafety(draft);
  if (safety.status === 'refused') {
    return res.status(400).json({
      error: { code: 'refused', message: safety.message },
    });
  }
  if (safety.status === 'crisis') {
    return res.status(400).json({
      error: { code: 'crisis_support', message: safety.message },
    });
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  const isMock = modelOverride === 'fake' || !ai;
  let parsedResult: any = null;
  let usedModel = isMock ? 'fake' : (modelOverride || 'gemini-3.1-flash-lite');

  if (isMock) {
    parsedResult = generateMockDiagnose(draft);
  } else {
    // Build Prompt
    const situationsDict = rubricData.situations || {};
    const sitKey = situation.toLowerCase();
    const sitInfo = situationsDict[situation] || situationsDict[sitKey] || { name: situation, description: situation };
    const rubricText = yaml.stringify(rubricData.dimensions || {});

    const safeDraft = draft.replace(/<\/student_draft>/g, '[/student_draft]');
    const safeRec = recipient.replace(/<\/?recipient>/g, '');
    const safeSitName = (sitInfo.name || situation).replace(/<\/situation>/g, '');
    const safeSitDesc = (sitInfo.description || situation).replace(/<\/situation>/g, '');

    const userPrompt = diagnosePromptTmpl
      .replace(/{recipient}/g, safeRec)
      .replace(/{situation_name}/g, safeSitName)
      .replace(/{situation_desc}/g, safeSitDesc)
      .replace(/{rubric_content}/g, rubricText)
      .replace(/{draft}/g, safeDraft);

    try {
      const resp = await ai!.models.generateContent({
        model: usedModel,
        contents: userPrompt,
        config: {
          systemInstruction: 'You are an expert academic and professional communication coach. You MUST respond with ONLY a valid, parseable JSON object matching the requested schema.',
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const cleaned = cleanJsonText(resp.text || '{}');
      parsedResult = JSON.parse(cleaned);

      if (parsedResult.error) {
        return res.status(400).json({ error: parsedResult.error });
      }
    } catch (err: any) {
      console.warn('Gemini diagnosis failed, using resilient fallback:', err?.message || err);
      parsedResult = generateMockDiagnose(draft);
      usedModel = 'fallback-mock';
    }
  }

  // Parse Scores and Dimensions deterministically
  const rawScores = parsedResult?.scores || {};
  function parseScore(val: any, targetMin = 4, targetMax = 5) {
    const rawVal = typeof val === 'object' && val !== null ? val.value ?? val.score ?? 3 : (typeof val === 'number' ? val : 3);
    const num = Math.max(1, Math.min(5, Math.round(Number(rawVal) || 3)));
    return { value: num, target_min: targetMin, target_max: targetMax };
  }

  const scores = {
    clarity: parseScore(rawScores.clarity, 4, 5),
    accountability: parseScore(rawScores.accountability, 4, 5),
    warmth: parseScore(rawScores.warmth, 3, 5),
    formality: parseScore(rawScores.formality, 3, 4),
    proportion: parseScore(rawScores.proportion, 3, 4),
  };

  const rubricDims = rubricData.dimensions || {};
  const dimSpecs = [
    { id: 'clarity', defaultLabel: 'Clarity of the ask', detail: scores.clarity },
    { id: 'accountability', defaultLabel: 'Owning your part', detail: scores.accountability },
    { id: 'warmth', defaultLabel: 'Warmth and respect', detail: scores.warmth },
    { id: 'formality', defaultLabel: 'Formality fit', detail: scores.formality },
    { id: 'proportion', defaultLabel: 'Proportion', detail: scores.proportion },
  ];

  const dimensionsList: any[] = [];
  const closenesses: number[] = [];

  for (const { id, defaultLabel, detail } of dimSpecs) {
    const rInfo = rubricDims[id] || {};
    const label = rInfo.name || defaultLabel;
    const desc = rInfo.description || 'Evaluation metric';
    const v = detail.value;
    const tMin = detail.target_min;
    const tMax = detail.target_max;

    let closeness = 1.0;
    if (v < tMin) {
      closeness = Math.max(0.0, 1.0 - (tMin - v) / 4.0);
    } else if (v > tMax) {
      closeness = Math.max(0.0, 1.0 - (v - tMax) / 4.0);
    }
    closenesses.push(closeness);

    dimensionsList.push({
      id,
      label,
      description: desc,
      value: v,
      target_min: tMin,
      target_max: tMax,
    });
  }

  const overallScore = closenesses.length
    ? Math.round(100 * (closenesses.reduce((a, b) => a + b, 0) / closenesses.length))
    : 50;

  // Process Flags
  const rawFlags = Array.isArray(parsedResult?.flags) ? parsedResult.flags : [];
  const validFlags = rawFlags
    .filter((f: any) => typeof f === 'object' && f !== null && f.text)
    .map((f: any) => {
      const pStr = String(f.principle || 'Clarity');
      const rStr = String(f.reason || f.why || 'Tone requires adjustment.');
      let dimId = f.dimension_id;
      if (!dimId) {
        const comb = `${pStr} ${rStr}`.toLowerCase();
        if (/accountab|own|blam|defens|excuse/.test(comb)) dimId = 'accountability';
        else if (/warm|respect|empath|considerat/.test(comb)) dimId = 'warmth';
        else if (/formal|casual|greet|sign-off|address/.test(comb)) dimId = 'formality';
        else if (/proport|brief|apolog|length|grovel/.test(comb)) dimId = 'proportion';
        else dimId = 'clarity';
      }
      return {
        text: String(f.text).trim(),
        reason: rStr,
        principle: pStr,
        nudge: String(f.nudge || f.suggestion || 'Consider rephrasing with greater professionalism.'),
        dimension_id: dimId,
      };
    });

  const latencyMs = performance.now() - start;
  logAudit({
    request_id: requestId,
    endpoint: '/diagnose',
    provider: isMock ? 'fake' : 'gemini',
    model: usedModel,
    input_sha256: hashText(draft),
    input_length: draft.length,
    latency_ms: Math.round(latencyMs * 100) / 100,
    status: 'success',
  });

  return res.json({
    request_id: requestId,
    prompt_version: 'diagnose.v1',
    rubric_version: rubricData.version || 'professor_ask.v1',
    verdict: parsedResult?.verdict || 'Your draft could be refined for better recipient perception.',
    scores,
    overall: overallScore,
    dimensions: dimensionsList,
    flags: validFlags,
  });
});

app.post('/rewrite', checkRateLimit, async (req, res) => {
  const start = performance.now();
  const draft = (req.body?.draft || '').trim();
  const recipient = (req.body?.recipient || 'Manager').trim();
  const situation = (req.body?.situation || 'General request').trim();
  const modelOverride = req.body?.model;

  if (draft.length < 15) {
    return res.status(422).json({
      error: { code: 'invalid_input', message: 'Draft must be at least 15 characters.' },
    });
  }

  const safety = evaluateSafety(draft);
  if (safety.status === 'refused') {
    return res.status(400).json({ error: { code: 'refused', message: safety.message } });
  }
  if (safety.status === 'crisis') {
    return res.status(400).json({ error: { code: 'crisis_support', message: safety.message } });
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  const isMock = modelOverride === 'fake' || !ai;
  let parsedResult: any = null;
  let usedModel = isMock ? 'fake' : (modelOverride || 'gemini-3.1-flash-lite');

  if (isMock) {
    parsedResult = generateMockRewrite(recipient, situation);
  } else {
    const situationsDict = rubricData.situations || {};
    const sitKey = situation.toLowerCase();
    const sitInfo = situationsDict[situation] || situationsDict[sitKey] || { name: situation, description: situation };

    const safeDraft = draft.replace(/<\/student_draft>/g, '[/student_draft]');
    const safeRec = recipient.replace(/<\/?recipient>/g, '');
    const safeSitName = (sitInfo.name || situation).replace(/<\/situation>/g, '');

    const userPrompt = rewritePromptTmpl
      .replace(/{recipient}/g, safeRec)
      .replace(/{situation_name}/g, safeSitName)
      .replace(/{draft}/g, safeDraft);

    try {
      const resp = await ai!.models.generateContent({
        model: usedModel,
        contents: userPrompt,
        config: {
          systemInstruction: 'You are an expert academic and professional writing coach. You MUST respond with ONLY a valid, parseable JSON object matching the requested schema.',
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const cleaned = cleanJsonText(resp.text || '{}');
      parsedResult = JSON.parse(cleaned);
    } catch (err: any) {
      console.warn('Gemini rewrite failed, using resilient fallback:', err?.message || err);
      parsedResult = generateMockRewrite(recipient, situation);
      usedModel = 'fallback-mock';
    }
  }

  const rawRewrite = (
    parsedResult?.rewrite ||
    parsedResult?.rewritten_draft ||
    parsedResult?.revised_draft ||
    parsedResult?.email ||
    parsedResult?.text ||
    ''
  ).trim();

  const changes = Array.isArray(parsedResult?.changes)
    ? parsedResult.changes.map((ch: any) => ({
        from: ch.from || ch.from_text || '',
        to: ch.to || ch.to_text || '',
        reason: ch.reason || 'Improves tone and clarity',
        principle: ch.principle || 'Clarity',
      }))
    : [];

  const latencyMs = performance.now() - start;
  logAudit({
    request_id: requestId,
    endpoint: '/rewrite',
    provider: isMock ? 'fake' : 'gemini',
    model: usedModel,
    input_sha256: hashText(draft),
    input_length: draft.length,
    latency_ms: Math.round(latencyMs * 100) / 100,
    status: 'success',
  });

  return res.json({
    request_id: requestId,
    prompt_version: 'rewrite.v1',
    rubric_version: rubricData.version || 'professor_ask.v1',
    rewrite: rawRewrite || generateMockRewrite(recipient, situation).rewrite,
    changes,
    takeaway: parsedResult?.takeaway || 'State the ask clearly and acknowledge accountability.',
    new_facts_introduced: parsedResult?.new_facts_introduced || [],
  });
});

// Serve frontend static files from app/static
const staticDir = path.resolve('app', 'static');
app.use(express.static(staticDir));

// Fallback to index.html for single page app
app.get('*', (req, res) => {
  res.sendFile(path.join(staticDir, 'index.html'));
});

// Start listening
app.listen(PORT, HOST, () => {
  console.log(`Unsaid / Say It Right server running on http://${HOST}:${PORT}`);
});
