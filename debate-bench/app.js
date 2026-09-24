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

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function resources(source) {
  const usage = (source && source.usage) || {};
  const inputTokens = Number(usage.input_tokens);
  const outputTokens = Number(usage.output_tokens);
  const cost = (Number.isFinite(inputTokens) ? inputTokens : 0) / 1e6 * 0.042;
  return [
    Number.isFinite(inputTokens) ? inputTokens.toLocaleString() + " in" : "",
    Number.isFinite(outputTokens) ? outputTokens.toLocaleString() + " out" : "",
    Number.isFinite(inputTokens) ? "$" + (cost < 0.01 ? cost.toFixed(6) : cost.toFixed(4)) : "",
    source && source.model ? escapeHtml(source.model) : "",
  ].filter(Boolean).join(" · ");
}

function stampFor(winner) {
  if (winner === "a") return "Side A";
  if (winner === "b") return "Side B";
  if (winner === "draw") return "Draw";
  return "No contest";
}

function guardLine(letter, g) {
  const tag = g.drop ? `<span class="drop">discarded · ${g.reasons.join(", ")}</span>` : "kept";
  return `<p class="meta">Side ${letter.toUpperCase()}: ${tag} · ungrounded ${Number(g.ungrounded).toFixed(2)} · fallacy ${Number(g.fallacy).toFixed(2)}</p>`;
}

function renderDebate(payload) {
  const v = payload.verdict || {};
  const disc = v.discarded || { a: {}, b: {} };
  const rows = (v.rows || []).map((r) => {
    return `<div class="dim">
      <h3>${escapeHtml(r.name)} <span class="meta">weight ${r.weight}</span></h3>
      <div class="split">
        <div><div class="row"><span>A</span><span>${Number(r.a).toFixed(2)} / 2</span></div>${bar(Number(r.a) / 2)}</div>
        <div><div class="row"><span>B</span><span>${Number(r.b).toFixed(2)} / 2</span></div>${bar(Number(r.b) / 2)}</div>
      </div>
    </div>`;
  }).join("");
  const totals = v.totals || { a: 0, b: 0 };
  return `<p class="stamp">${stampFor(v.winner)}</p>
    ${guardLine("a", disc.a || {})}
    ${guardLine("b", disc.b || {})}
    <div class="row"><span>Weighted total A</span><span>${Number(totals.a).toFixed(2)} / 2</span></div>${bar(Number(totals.a) / 2)}
    <div class="row"><span>Weighted total B</span><span>${Number(totals.b).toFixed(2)} / 2</span></div>${bar(Number(totals.b) / 2)}
    ${rows}
    <p class="meta">${resources(payload)}</p>`;
}

const SAMPLE_MS = 4000;
const SAMPLES = {
  "debate-bench": [
    {
      a: "We should keep working from home. Our last quarter, support tickets closed 12% faster and people saved two hours a day on commuting. Nobody asked to come back five days a week.",
      b: "The office is better. Everyone knows you cannot really work in pajamas. My cousin's friend quit remote work, so remote work fails.",
      criteria: "Evidence | 3 | Uses facts from this case, not slogans\nFairness | 2 | Answers the other side\nClarity | 1 | Easy to follow",
    },
    {
      a: "Add a protected bike lane on Main Street. Last year 14 people were hurt on that stretch. A similar lane on Oak Street cut injuries in half.",
      b: "Keep the parking. Shop owners say they need spots. We have not measured sales yet, but people will stop coming if they cannot park in front.",
      criteria: "Evidence | 3 | Uses numbers or a local example\nTradeoffs | 2 | Names who loses and who gains\nClarity | 1 | Easy to follow",
    },
    {
      a: "Start school at 9am. Teen sleep studies show later starts raise attendance. Our own late-bus week last spring had fewer nurse visits.",
      b: "Keep the 7:30 start. Parents who work early need it. Later start is just kids being lazy.",
      criteria: "Evidence | 3 | Backs the claim with a reason you can check\nFairness | 2 | Takes the other side seriously\nPracticality | 2 | Could a real school do this",
    },
    {
      a: "Sales rose 8% this quarter, from $2.0M to $2.16M. One new client was 1 point of that. The rest was repeat customers.",
      b: "Sales only look up because of one whale. Without them we would be flat. The dashboard still shows 8%, so the whale story is just an excuse.",
      criteria: "Evidence | 3 | Matches the numbers given\nFairness | 2 | Does not ignore the other dataset\nClarity | 1 | Easy to follow",
    },
    {
      a: "Paper bags. They tear in the rain and we already reuse canvas. The city composts paper. Plastic lingers in the creek behind the store.",
      b: "Anyone who wants paper is a fool. Plastic is always better. I said so on Facebook.",
      criteria: "Evidence | 3 | Grounded in a real cost or harm\nFairness | 1 | No insults in place of reasons\nClarity | 1 | Easy to follow",
    },
    {
      a: "Stream at home. Tickets are $18. A family of four saves about $50 and we can pause for kids.",
      b: "Theaters are magic. Opening weekend in a dark room is the point of movies. Streaming can wait a month.",
      criteria: "Evidence | 2 | Names a real cost or experience\nValues | 2 | Says what they care about\nFairness | 1 | Lets the other side exist",
    },
    {
      a: "Put the extra $2M into buses. Night-shift workers miss the last bus at 8pm. Three employers wrote to the council about this.",
      b: "Fix potholes. The west-side stretch has 40 complaints this year. Buses do not help if cars cannot get to the park-and-ride.",
      criteria: "Evidence | 3 | Uses a local fact\nWho is served | 2 | Names who benefits\nClarity | 1 | Easy to follow",
    },
    {
      a: "Phones cause rain. A blog said so. Every time I forget an umbrella it pours, so the science is settled.",
      b: "Rain comes from weather systems. Our city's wettest days last year lined up with storms on the radar, not with phone sales.",
      criteria: "Evidence | 3 | Can be checked\nFairness | 1 | Stays on the question\nClarity | 1 | Easy to follow",
    },
    {
      a: "Cats. They use a box, they are fine alone during a long shift, and vet bills at our clinic averaged less than the dog visits last year.",
      b: "Dogs. They get you walking. Our block's evening group is all dog people. Cats just knock cups over.",
      criteria: "Evidence | 2 | Uses a lived fact, not a meme\nFit | 2 | Matches a real daily life\nFairness | 1 | Does not smear the other pet",
    },
    {
      a: "Keep the library open Sundays. Last quarter Sunday visits were 1,200, mostly students. Closing saves one staff shift and loses that use.",
      b: "Close Sundays. Nobody reads anymore. My group chat thinks libraries are dead.",
      criteria: "Evidence | 3 | Uses a count or a named group\nFairness | 2 | Answers the money vs use tradeoff\nClarity | 1 | Easy to follow",
    },
  ],
};

function applySample(sample) {
  if (!sample) return;
  for (const [name, value] of Object.entries(sample)) {
    const el = form.elements.namedItem(name);
    if (el) el.value = value;
  }
}

(function rotateSamples() {
  const list = SAMPLES["debate-bench"];
  let i = 0;
  let paused = false;
  applySample(list[0]);
  const timer = setInterval(() => {
    if (paused) return;
    i = (i + 1) % list.length;
    applySample(list[i]);
  }, SAMPLE_MS);
  form.addEventListener("input", () => {
    paused = true;
    clearInterval(timer);
  });
  form.addEventListener("focusin", () => {
    paused = true;
  });
})();

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  err.textContent = "";
  btn.disabled = true;
  out.innerHTML = "<p class='meta'>Asking Jev…</p>";
  const data = Object.fromEntries(new FormData(form).entries());
  try {
    const res = await fetch("/api/judge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site: "debate-bench", state: data }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || res.statusText);
    out.innerHTML = renderDebate(json);
  } catch (ex) {
    out.innerHTML = "";
    err.textContent = ex.message || String(ex);
  } finally {
    btn.disabled = false;
  }
});
