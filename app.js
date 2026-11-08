// ASHA Guard UI. Wires the policy engine in guard.js to the page.
// Everything runs on this device. Nothing is sent anywhere.

(function () {
  var policy = createGuardPolicy({ dailyCap: 50 });
  var pendingHeld = null; // a symptom question held for supervisor confirmation

  function $(id) { return document.getElementById(id); }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function showTab(name) {
    var tabs = document.querySelectorAll(".tab-panel");
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove("active");
    var navs = document.querySelectorAll(".nav-btn");
    for (var j = 0; j < navs.length; j++) navs[j].classList.remove("active");
    $("tab-" + name).classList.add("active");
    var btn = document.querySelector('[data-tab="' + name + '"]');
    if (btn) btn.classList.add("active");
    if (name === "ledger") renderLedger();
    if (name === "rules") renderStatus();
  }

  function renderStatus() {
    var count = answersToday();
    var entries = loadLedger();
    $("stat-answers").textContent = count + " / " + policy.dailyCap;
    $("stat-ledger").textContent = entries.length;
    $("stat-policy").textContent = "Active";
    var bar = $("cap-bar");
    if (bar) bar.style.width = Math.min(100, Math.round((count / policy.dailyCap) * 100)) + "%";
    var foot = $("status-answers");
    if (foot) foot.textContent = "Answers today: " + count + " of " + policy.dailyCap;
  }

  function decisionBadge(decision) {
    if (decision === "ALLOWED") return '<span class="badge ok">ALLOWED</span>';
    if (decision === "NEEDS_CONFIRMATION") return '<span class="badge warn">NEEDS SUPERVISOR</span>';
    return '<span class="badge bad">BLOCKED</span>';
  }

  function ruleLine(rule) {
    if (!rule) return "No rule blocked this answer.";
    var names = {
      dailyCap: "Daily cap (50 answers a day)",
      noDoseNoDiagnosis: "No dose, no diagnosis rule",
      allowlist: "Allowlist of approved sources",
      confirmThreshold: "Confirm threshold (supervisor confirmation)"
    };
    return "Rule applied: " + (names[rule] || rule) + ".";
  }

  function answerCard(html) {
    var box = $("answer-box");
    box.innerHTML = html;
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function scheduleAnswerHtml(row, question) {
    var items = row.vaccines.map(function (v) {
      return "<li>" + escapeHtml(v) + "</li>";
    }).join("");
    var note = row.note ? "<p class=\"note\">" + escapeHtml(row.note) + "</p>" : "";
    var missed = question.toLowerCase().indexOf("miss") !== -1;
    var extra = missed
      ? "<p class=\"note\"><strong>Missed dose:</strong> take the child to the next immunisation session and show the card. The nurse at the session works out the catch-up doses. ASHA Guard does not decide catch-up doses.</p>"
      : "";
    return '<div class="card answer ok-border">' +
      "<h3>Due at " + escapeHtml(row.age) + "</h3>" +
      "<ul>" + items + "</ul>" + note + extra +
      '<p class="source">Source: National Immunisation Schedule, Ministry of Health and Family Welfare, Government of India.</p>' +
      "</div>";
  }

  function dangerAnswerHtml(cls) {
    var group = DANGER_SIGNS[cls.group];
    var matched = cls.matched.map(function (m) {
      return "<li>" + escapeHtml(m) + "</li>";
    }).join("");
    return '<div class="card answer bad-border">' +
      "<h3>URGENT: danger sign found, refer now</h3>" +
      "<p>This matches a danger sign in the " + escapeHtml(group.title) + " list:</p>" +
      "<ul>" + matched + "</ul>" +
      "<p><strong>Take the mother or baby to the nearest health facility now. Do not wait for the next visit. Show this note to the nurse or doctor.</strong></p>" +
      '<p class="source">Source: ' + escapeHtml(group.source) + ". This is a referral prompt, not a diagnosis.</p>" +
      "</div>";
  }

  function ask(question, confirmed) {
    question = (question || "").trim();
    if (!question) return;
    pendingHeld = null;

    var cls = classifyQuery(question);
    var result = policy.check({
      kind: cls.kind,
      topic: cls.topic,
      answersToday: answersToday(),
      confirmed: !!confirmed
    });

    var logSummary = "";
    var card = "";

    if (result.decision === "ALLOWED" && cls.kind === "danger") {
      card = dangerAnswerHtml(cls);
      logSummary = "Danger sign, urgent referral: " + cls.matched.join(", ");
    } else if (result.decision === "ALLOWED" && cls.kind === "schedule") {
      var row = findScheduleRow(question);
      if (row) {
        card = scheduleAnswerHtml(row, question);
        logSummary = "Schedule answer for age: " + row.age;
      } else {
        card = '<div class="card answer ok-border"><h3>Immunisation schedule</h3>' +
          "<p>I could not tell the age from the question. Pick an age below, or ask with the age, for example \"baby is 6 weeks old\".</p>" +
          '<p class="source">Source: National Immunisation Schedule, Ministry of Health and Family Welfare, Government of India.</p></div>';
        logSummary = "Schedule question, age not given";
      }
    } else if (result.decision === "NEEDS_CONFIRMATION") {
      pendingHeld = { question: question, cls: cls };
      card = '<div class="card answer warn-border">' +
        "<h3>Held for your supervisor</h3>" +
        "<p>" + escapeHtml(result.reason) + "</p>" +
        "<p>This symptom is not a listed danger sign, so I cannot answer it on my own. In demo mode the supervisor confirmation below is simulated. In real use this goes to your ANM.</p>" +
        '<button class="btn primary" id="confirm-btn">Simulate supervisor confirmation (demo)</button>' +
        '<p class="source">Rule applied: confirm threshold (supervisor confirmation).</p>' +
        "</div>";
      logSummary = "Symptom held for supervisor: " + (cls.matched || "");
      addLedgerEntry({ question: question, decision: result.decision, rule: result.rule, summary: logSummary });
      renderStatus();
      answerCard('<div class="decision-row">' + decisionBadge(result.decision) + '<span class="rule-text">' + escapeHtml(ruleLine(result.rule)) + "</span></div>" + card);
      var btn = $("confirm-btn");
      if (btn) btn.addEventListener("click", function () { confirmHeld(); });
      return;
    } else {
      // BLOCKED
      card = '<div class="card answer bad-border">' +
        "<h3>Blocked by the guard</h3>" +
        "<p>" + escapeHtml(result.reason) + "</p>" +
        '<p class="source">Rule applied: ' + escapeHtml(ruleLine(result.rule)) + "</p>" +
        "</div>";
      logSummary = result.reason;
    }

    addLedgerEntry({ question: question, decision: result.decision, rule: result.rule, summary: logSummary });
    renderStatus();
    answerCard('<div class="decision-row">' + decisionBadge(result.decision) + '<span class="rule-text">' + escapeHtml(ruleLine(result.rule)) + "</span></div>" + card);
  }

  function confirmHeld() {
    if (!pendingHeld) return;
    var held = pendingHeld;
    pendingHeld = null;
    var result = policy.check({
      kind: held.cls.kind,
      topic: held.cls.topic,
      answersToday: answersToday(),
      confirmed: true
    });
    var card = '<div class="card answer warn-border">' +
      "<h3>Supervisor confirmed (demo)</h3>" +
      "<p>Your supervisor has seen this symptom. Follow your ASHA training module for this symptom, and watch for danger signs. If any danger sign appears, refer at once. If the symptom does not improve in 2 days, refer to the ANM.</p>" +
      "<p>ASHA Guard does not name a medicine or a dose, even after confirmation.</p>" +
      '<p class="source">Confirmed by supervisor (simulated in demo mode). Rule applied: confirm threshold.</p>' +
      "</div>";
    addLedgerEntry({ question: held.question, decision: result.decision, rule: result.rule, summary: "Symptom confirmed by supervisor (demo), module guidance given" });
    renderStatus();
    answerCard('<div class="decision-row">' + decisionBadge(result.decision) + '<span class="rule-text">Confirmed by supervisor, demo simulation.</span></div>' + card);
  }

  function renderSchedule() {
    var html = "";
    for (var i = 0; i < NIS_SCHEDULE.length; i++) {
      var row = NIS_SCHEDULE[i];
      var items = row.vaccines.map(function (v) {
        return "<li>" + escapeHtml(v) + "</li>";
      }).join("");
      html += '<div class="card sched-row"><h3>' + escapeHtml(row.age) + "</h3><ul>" + items + "</ul>" +
        (row.note ? '<p class="note">' + escapeHtml(row.note) + "</p>" : "") + "</div>";
    }
    $("schedule-list").innerHTML = html;
  }

  function renderDanger() {
    var html = "";
    var keys = ["newborn", "child", "pregnancy"];
    for (var i = 0; i < keys.length; i++) {
      var g = DANGER_SIGNS[keys[i]];
      var items = g.signs.map(function (s) {
        return "<li>" + escapeHtml(s) + "</li>";
      }).join("");
      html += '<div class="card danger-card"><h3>' + escapeHtml(g.title) + "</h3><ul>" + items + "</ul>" +
        '<p class="source">Source: ' + escapeHtml(g.source) + ".</p>" +
        "<p><strong>If you see any of these: take the mother or baby to the nearest facility now. Do not wait.</strong></p></div>";
    }
    $("danger-list").innerHTML = html;
  }

  function renderLedger() {
    var entries = loadLedger();
    var body = $("ledger-body");
    if (entries.length === 0) {
      body.innerHTML = '<tr><td colspan="4" class="empty">No entries yet. Ask a question and it will be recorded here.</td></tr>';
      return;
    }
    var html = "";
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var d = new Date(e.time);
      var when = d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
      html += "<tr><td>" + escapeHtml(when) + "</td><td>" + escapeHtml(e.question) + "</td><td>" +
        decisionBadge(e.decision) + "</td><td>" + escapeHtml(e.summary || "") + "</td></tr>";
    }
    body.innerHTML = html;
  }

  function exportLedger() {
    var data = JSON.stringify(loadLedger(), null, 2);
    var blob = new Blob([data], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "asha-guard-ledger.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function init() {
    var navs = document.querySelectorAll(".nav-btn");
    for (var i = 0; i < navs.length; i++) {
      navs[i].addEventListener("click", function () {
        showTab(this.getAttribute("data-tab"));
      });
    }
    $("ask-btn").addEventListener("click", function () {
      ask($("ask-input").value, false);
    });
    $("ask-input").addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") ask($("ask-input").value, false);
    });
    var chips = document.querySelectorAll(".chip");
    for (var j = 0; j < chips.length; j++) {
      chips[j].addEventListener("click", function () {
        $("ask-input").value = this.getAttribute("data-q");
        ask(this.getAttribute("data-q"), false);
      });
    }
    $("export-btn").addEventListener("click", exportLedger);
    $("clear-btn").addEventListener("click", function () {
      if (window.confirm("Clear the whole ledger and today's answer count? This cannot be undone.")) {
        saveLedger([]);
        renderLedger();
        renderStatus();
      }
    });
    $("reset-btn").addEventListener("click", function () {
      if (window.confirm("Reset all demo data, ledger and answer counts?")) {
        saveLedger([]);
        renderLedger();
        renderStatus();
      }
    });
    var today = new Date();
    $("today-date").textContent = today.toLocaleDateString("en-IN", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    });
    renderSchedule();
    renderDanger();
    renderStatus();
    renderLedger();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
