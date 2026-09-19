
const form = document.getElementById("form");
const out = document.getElementById("out");
const err = document.getElementById("err");
const btn = document.getElementById("go");

function bar(v) {
  const pct = Math.max(0, Math.min(100, Math.round(Number(v) * 100)));
  return `<div class="bar"><span style="width:${pct}%"></span></div>`;
}

function noul(label, v) {
  const n = Number(v);
  return `<div class="row"><span>${label}</span><span>${n.toFixed(2)}</span></div>${bar(n)}`;
}

function score(label, a) {
  const s = Number(a.score);
  const max = Object.keys(a.legend || {}).length ? Object.keys(a.legend).length - 1 : 2;
  return `<div class="row"><span>${label}</span><span>${s.toFixed(2)} / ${max}</span></div>${bar(s / (max || 1))}
    <div class="meta">${Object.entries(a.legend || {}).map(([k,v]) => k + ": " + v).join(" · ")}</div>`;
}

function renderTriage(a) {
  return `<p class="stamp">${a.department.choice}</p>
    ${score("Urgency", a.urgency)}
    ${noul("Refund asked", a.refund_asked.noul)}
    <p class="meta">department confidence ${Number(a.department.confidence).toFixed(2)} · next: ${
      a.refund_asked.noul > 0.8 && a.department.choice === "billing" ? "auto-refund if policy allows" : "human queue"
    }</p>`;
}

function renderLead(a) {
  return `${score("Overall fit", a.overall)}
    ${noul("Industry", a.industry_fit.noul)}
    ${noul("Stage", a.stage_fit.noul)}
    ${noul("Buyer", a.buyer_fit.noul)}`;
}

function renderListing(a) {
  const tone = a.decision.choice;
  return `<p class="stamp">${tone.toUpperCase()}</p>
    ${noul("Prohibited", a.prohibited.noul)}
    ${noul("Counterfeit", a.counterfeit.noul)}
    ${noul("Spam", a.spam.noul)}
    <p class="meta">confidence ${Number(a.decision.confidence).toFixed(2)}</p>`;
}

function renderCite(a) {
  return `<p class="stamp">${a.support.choice}</p>
    <p class="meta">confidence ${Number(a.support.confidence).toFixed(2)} · ${
      Number(a.support.confidence) < 0.45 ? "send to review" : "act"
    }</p>
    <pre>${JSON.stringify(a.support.probabilities, null, 2)}</pre>`;
}

function renderGuard(a) {
  const block = a.jailbreak.noul > 0.7 || a.harm.score >= 1.6;
  return `<p class="stamp">${block ? "BLOCK" : a.harm.score >= 1 ? "REVIEW" : "PASS"}</p>
    ${noul("Jailbreak", a.jailbreak.noul)}
    ${noul("Injection", a.injection.noul)}
    ${noul("PII", a.pii.noul)}
    ${score("Harm if complied", a.harm)}`;
}

function renderSkill(a) {
  const pick = a.needs_skill.noul < 0.4 ? "none" : a.skill.choice;
  return `<p class="stamp">${pick}</p>
    ${noul("Needs a skill", a.needs_skill.noul)}
    <p class="meta">raw choice ${a.skill.choice} · confidence ${Number(a.skill.confidence).toFixed(2)}</p>`;
}

function renderResume(a) {
  return `<p class="stamp">${a.next_step.choice}</p>
    ${score("Required skills", a.required_skills)}
    ${score("Leadership", a.leadership)}
    ${score("Domain", a.domain)}`;
}

function renderClause(payload) {
  const a = payload.answers;
  const lines = payload.lines || [];
  const id = a.line && a.line.choice;
  const html = lines.map((ln) => {
    const mark = String(ln.id) === String(id) ? "hl" : "";
    return `<div class="${mark}">${ln.id}. ${escapeHtml(ln.text)}</div>`;
  }).join("");
  return `${noul("Document answers the question", a.answered.noul)}
    <p class="stamp">line ${id}</p>
    <pre>${html}</pre>
    <p class="meta">Jev selected an id. Text is copied, not rewritten.</p>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const renders = { renderTriage, renderLead, renderListing, renderCite, renderGuard, renderSkill, renderResume, renderClause };

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  err.textContent = "";
  btn.disabled = true;
  out.innerHTML = "<p class='meta'>Asking Jev…</p>";
  const data = Object.fromEntries(new FormData(form).entries());
  try {
    const site = location.pathname.split("/").filter(Boolean)[0];
    const res = await fetch("/api/judge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site, state: data }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || res.statusText);
    const fn = renders[form.dataset.render];
    out.innerHTML = fn(json.lines ? json : json.answers);
  } catch (ex) {
    out.innerHTML = "";
    err.textContent = ex.message || String(ex);
  } finally {
    btn.disabled = false;
  }
});
