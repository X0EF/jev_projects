const SITES = {
  "triage-desk": {
    department: {
      type: "choice",
      instructions: "Which team should handle this ticket?",
      criteria: {
        billing: "Payments, invoices, refunds, payouts, Stripe charges",
        technical: "Bugs, outages, integrations, account connection failures",
        account: "Login, permissions, profile, not a payment or bug",
      },
    },
    urgency: {
      type: "score",
      instructions: "How time-sensitive is this for the customer?",
      criteria: [
        "No time pressure; routine request",
        "Impatient but business can wait a day",
        "Immediate revenue or outage; act now",
      ],
    },
    refund_asked: {
      type: "noul",
      instructions: "Does the customer request a refund, chargeback, or money back?",
      criteria: { true: "Explicit refund or money-back request", false: "No refund requested" },
    },
  },
  "lead-fit": {
    industry_fit: {
      type: "noul",
      instructions: "Does the company match the industry and business model in `icp`?",
      criteria: { true: "Clear industry and model match", false: "Wrong industry or model" },
    },
    stage_fit: {
      type: "noul",
      instructions: "Does company stage and size match `icp`?",
      criteria: { true: "Stage and size in range", false: "Too early, too late, or wrong size" },
    },
    buyer_fit: {
      type: "noul",
      instructions: "Is there a relevant buyer or pain that matches `icp`?",
      criteria: { true: "Named buyer or matching pain", false: "No buyer signal" },
    },
    overall: {
      type: "score",
      instructions: "Overall ICP fit for outbound this week",
      criteria: ["Skip — not the customer", "Nurture — partial fit", "Work now — strong fit"],
    },
  },
  "listing-cop": {
    decision: {
      type: "choice",
      instructions: "Should this listing stay up as written?",
      criteria: {
        allow: "Ordinary goods, no policy issue",
        warn: "Suspicious or needs human review, not a clear ban",
        block: "Prohibited, counterfeit, scam, or unsafe",
      },
    },
    prohibited: {
      type: "noul",
      instructions: "Does the listing violate a typical marketplace prohibited-items rule?",
      criteria: { true: "Weapons, drugs, fraud, or banned category", false: "Allowed category" },
    },
    counterfeit: {
      type: "noul",
      instructions: "Does the seller signal replicas, fakes, or unofficial branded goods?",
      criteria: { true: "Replica, 1:1, fake, or unofficial brand", false: "No counterfeit signal" },
    },
    spam: {
      type: "noul",
      instructions: "Is this spam, off-platform payment, or bait?",
      criteria: { true: "WhatsApp pay, phishing, or junk", false: "Normal listing copy" },
    },
  },
  "cite-check": {
    support: {
      type: "choice",
      instructions: "Does `source` support `claim` as stated?",
      criteria: {
        supports: "The passage directly backs the claim",
        partial: "Related but weaker, narrower, or hedged",
        contradicts: "The passage conflicts with the claim",
        unrelated: "The passage is about something else",
      },
    },
  },
  "prompt-guard": {
    jailbreak: {
      type: "noul",
      instructions: "Is this a jailbreak or instruction-override attempt?",
      criteria: { true: "Ignore previous, DAN, developer mode, leak system prompt", false: "Ordinary user request" },
    },
    injection: {
      type: "noul",
      instructions: "Does the text try to smuggle instructions for another model or tool?",
      criteria: { true: "Hidden or role-play instructions for a downstream agent", false: "No injection" },
    },
    pii: {
      type: "noul",
      instructions: "Does the message contain secrets, passwords, or sensitive personal data?",
      criteria: { true: "Secrets or sensitive PII present", false: "No sensitive data" },
    },
    harm: {
      type: "score",
      instructions: "How harmful would it be to fully comply?",
      criteria: ["Harmless to comply", "Policy issue or mild misuse", "Serious safety, security, or abuse risk"],
    },
  },
  "skill-pick": {
    needs_skill: {
      type: "noul",
      instructions: "Does this turn need a tool or skill, or can it be answered from chat alone?",
      criteria: { true: "Needs a tool", false: "Chat-only" },
    },
    skill: {
      type: "choice",
      instructions: "If a skill is needed, which one from `catalog` should run? Use none if nothing fits.",
      criteria: {
        web_search: "Public web lookup",
        repo_read: "Find or open local files",
        shell: "Run a command",
        browser: "Interact with a website",
        none: "No skill",
      },
    },
  },
  "resume-match": {
    required_skills: {
      type: "score",
      instructions: "How well does the resume evidence the required technical skills in `job`?",
      criteria: ["Missing the core skills", "Partial or adjacent skills", "Clear evidence of the required skills"],
    },
    leadership: {
      type: "score",
      instructions: "How well does the resume evidence the leadership or ownership asked in `job`?",
      criteria: ["No leadership evidence", "Informal ownership", "Managed people or a workstream"],
    },
    domain: {
      type: "score",
      instructions: "How close is the domain experience to `job`?",
      criteria: ["Unrelated domain", "Transferable adjacent domain", "Same domain"],
    },
    next_step: {
      type: "choice",
      instructions: "What should a recruiter do next, given only this text?",
      criteria: {
        interview: "Strong enough to screen live",
        more_info: "Ask a clarifying question first",
        reject: "Not a fit on stated requirements",
      },
    },
  },
};

async function typesafe(key, state, questions) {
  const r = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ state, model: "jev-latest", questions }),
  });
  const json = await r.json();
  return { ok: r.ok, status: r.status, json };
}

function parseRules(raw) {
  const lines = String(raw || "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
  const used = new Set();
  const rules = [];
  for (const line of lines) {
    const split = line.match(/^(.{1,60}?)\s*[:|]\s+(.+)$/);
    let label;
    let detail;
    if (split) {
      label = split[1].replace(/^[-*\d.)\s]+/, "").trim();
      detail = split[2].trim();
    } else {
      label = line.replace(/^[-*\d.)\s]+/, "").trim();
      detail = label;
    }
    if (!label) continue;
    let id = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 32);
    if (!id || !/^[a-z]/.test(id)) id = "rule_" + (rules.length + 1);
    let unique = id;
    let n = 2;
    while (used.has(unique)) unique = id.slice(0, 28) + "_" + n++;
    used.add(unique);
    rules.push({ id: unique, label, detail: detail.slice(0, 240) });
  }
  if (!rules.length) return null;
  if (!rules.some((r) => r.id === "none")) {
    rules.push({
      id: "none",
      label: "None",
      detail: "The post does not violate a listed rule",
    });
  }
  return rules;
}

async function ruleCheck(key, state) {
  const rules = parseRules(state.rules);
  if (!rules) return { error: "Add at least one rule, one per line", status: 400 };
  const post = String(state.post || "").trim();
  const image = String(state.image || "").trim();
  if (!post && !image) return { error: "Add a post or describe the image", status: 400 };
  const criteria = Object.fromEntries(rules.map((r) => [r.id, r.detail]));
  const questions = {
    rule: {
      type: "choice",
      instructions:
        "Which Discord rule does this post violate? Categories are in `rules`. Read `post` and `image` together. `image` is a description of an attached picture. Choose none when no listed rule is broken.",
      criteria,
    },
  };
  const { ok, status, json } = await typesafe(key, { rules, post, image }, questions);
  if (!ok) return { error: json.message || json.error || "TypeSafe error", detail: json, status };
  json.rules = rules;
  return { json, status: 200 };
}

async function clauseFinder(key, state) {
  const raw = String(state.document || "");
  const query = String(state.query || "");
  const lines = raw
    .split(/\r?\n/)
    .map((text, i) => ({ id: String(i + 1), text: text.trim() }))
    .filter((l) => l.text)
    .slice(0, 60);
  if (!lines.length || !query) return { error: "Need document and query", status: 400 };
  const questions = {
    answered: {
      type: "noul",
      instructions: "Does any line in `lines` answer `query`?",
      criteria: { true: "At least one line answers it", false: "No line answers it" },
    },
    line: {
      type: "choice",
      instructions: "Which single line id best answers `query`? Pick the closest line even if incomplete.",
      criteria: Object.fromEntries(lines.map((l) => [l.id, l.text.slice(0, 180)])),
    },
  };
  const { ok, status, json } = await typesafe(key, { query, lines }, questions);
  if (!ok) return { error: json.message || json.error || "TypeSafe error", detail: json, status };
  json.lines = lines;
  return { json, status: 200 };
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "content-type");
    return res.status(204).end();
  }
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const key = process.env.TYPESAFE_API_KEY;
  if (!key) return res.status(500).json({ error: "TYPESAFE_API_KEY is not set on the server" });
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const site = body.site;
  const state = body.state;
  if (!state || !site) return res.status(400).json({ error: "Missing site or state" });
  if (site === "rule-check") {
    const out = await ruleCheck(key, state);
    if (out.error) return res.status(out.status || 500).json({ error: out.error, detail: out.detail });
    return res.status(200).json(out.json);
  }
  if (site === "clause-finder") {
    const out = await clauseFinder(key, state);
    if (out.error) return res.status(out.status || 500).json({ error: out.error, detail: out.detail });
    return res.status(200).json(out.json);
  }
  const questions = SITES[site];
  if (!questions) return res.status(400).json({ error: "Unknown site" });
  const { ok, status, json } = await typesafe(key, state, questions);
  if (!ok) return res.status(status).json({ error: json.message || json.error || "TypeSafe error", detail: json });
  return res.status(200).json(json);
};
