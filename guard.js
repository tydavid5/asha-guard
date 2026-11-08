// ASHA Guard, guarded assistant for ASHA workers.
// Policy engine adapted from the spending policy engine pattern:
// per-call and daily caps, an allowlist of approved sources, a confirm
// threshold, and a ledger. No money here, the engine gates health answers.
// It never gives a diagnosis, a medicine name, or a dose. Those go to a
// human supervisor. Danger signs are never gated, they go straight to
// an urgent referral.

// ---------------------------------------------------------------------------
// Protocol data, from real sources only. See README.md for the source list.
// ---------------------------------------------------------------------------

var NIS_SCHEDULE = [
  {
    age: "Birth",
    vaccines: [
      "BCG (protects against severe childhood tuberculosis)",
      "Oral polio vaccine, dose 0 (bOPV-0)",
      "Hepatitis B birth dose"
    ],
    note: "Given before the baby leaves the health facility."
  },
  {
    age: "6 weeks",
    vaccines: [
      "Oral polio vaccine, dose 1 (bOPV-1)",
      "Pentavalent 1 (diphtheria, pertussis, tetanus, hepatitis B, Hib)",
      "Fractional inactivated polio vaccine 1 (fIPV-1)",
      "Rotavirus vaccine 1 (RVV-1)",
      "Pneumococcal conjugate vaccine 1 (PCV-1)"
    ],
    note: ""
  },
  {
    age: "10 weeks",
    vaccines: [
      "Oral polio vaccine, dose 2 (bOPV-2)",
      "Pentavalent 2",
      "Rotavirus vaccine 2 (RVV-2)"
    ],
    note: ""
  },
  {
    age: "14 weeks",
    vaccines: [
      "Oral polio vaccine, dose 3 (bOPV-3)",
      "Pentavalent 3",
      "Fractional inactivated polio vaccine 2 (fIPV-2)",
      "Rotavirus vaccine 3 (RVV-3)",
      "Pneumococcal conjugate vaccine 2 (PCV-2)"
    ],
    note: ""
  },
  {
    age: "9 to 12 months",
    vaccines: [
      "Measles-rubella 1 (MR-1)",
      "Japanese encephalitis 1 (JE-1, endemic districts only)",
      "Pneumococcal conjugate vaccine booster (PCV booster)",
      "Vitamin A, 1st dose"
    ],
    note: ""
  },
  {
    age: "16 to 24 months",
    vaccines: [
      "Measles-rubella 2 (MR-2)",
      "Japanese encephalitis 2 (JE-2, endemic districts only)",
      "DPT booster 1 (diphtheria, pertussis, tetanus)",
      "Oral polio vaccine booster (bOPV booster)",
      "Vitamin A, 2nd to 9th dose, one dose every 6 months up to 5 years"
    ],
    note: ""
  },
  {
    age: "5 to 6 years",
    vaccines: ["DPT booster 2"],
    note: ""
  },
  {
    age: "10 years",
    vaccines: ["Tetanus-diphtheria (Td)"],
    note: ""
  },
  {
    age: "16 years",
    vaccines: ["Tetanus-diphtheria (Td)"],
    note: ""
  },
  {
    age: "Pregnant women",
    vaccines: [
      "Tetanus-diphtheria 1 (Td-1, early in pregnancy)",
      "Tetanus-diphtheria 2 (Td-2, at least 4 weeks after Td-1)",
      "Td booster if previously immunised"
    ],
    note: "Given at pregnancy registration or the first antenatal visit."
  }
];

var DANGER_SIGNS = {
  newborn: {
    title: "Newborn, 0 to 2 months",
    source: "IMNCI, possible severe bacterial infection (WHO and UNICEF)",
    signs: [
      "Convulsions (fits)",
      "Fast breathing, 60 or more breaths per minute",
      "Severe chest indrawing",
      "Fever, 37.5 C or higher",
      "Low body temperature, below 35.5 C, or feels cold to touch",
      "Lethargic or unconscious",
      "Less movement than normal, or no movement",
      "Not feeding well, or stopped feeding",
      "Nasal flaring or grunting",
      "Bulging fontanelle (the soft spot on the head bulging out)",
      "Umbilical redness spreading to the skin, or pus from the cord",
      "10 or more skin pustules, or one large pustule",
      "Yellow skin or yellow eyes (jaundice)"
    ]
  },
  child: {
    title: "Child, 2 months to 5 years",
    source: "IMNCI general danger signs (WHO and UNICEF)",
    signs: [
      "Lethargic or unconscious",
      "Convulsions, now or during this illness",
      "Unable to drink or breastfeed",
      "Vomits everything"
    ]
  },
  pregnancy: {
    title: "Pregnancy",
    source: "WHO Pregnancy, Childbirth, Postpartum and Newborn Care (2015)",
    signs: [
      "Severe vaginal bleeding",
      "Convulsions (fits)",
      "Severe headache with blurred vision",
      "Severe abdominal pain",
      "Too weak to get out of bed",
      "Fast or difficult breathing",
      "Reduced fetal movement, baby moving much less than usual",
      "Fever",
      "Swelling of the fingers, face and legs"
    ]
  }
};

// Approved sources only. Nothing else can be cited in an answer.
var ALLOWLIST_SOURCES = [
  "National Immunisation Schedule, Ministry of Health and Family Welfare, Government of India",
  "IMNCI danger signs, WHO and UNICEF",
  "WHO Pregnancy, Childbirth, Postpartum and Newborn Care (2015)"
];

// ---------------------------------------------------------------------------
// Policy engine. Same shape as the spending policy engine it is adapted
// from: caps, an allowlist, a confirm threshold, and a decision object
// with decision, reason and rule.
// ---------------------------------------------------------------------------

function createGuardPolicy(options) {
  options = options || {};
  return {
    dailyCap: options.dailyCap || 50,
    allowlist: new Set(options.allowlist || [
      "immunisation", "danger-newborn", "danger-child",
      "danger-pregnancy", "symptom"
    ]),
    // check a classified query. answersToday is the count of answers
    // already given today. confirmed is true only after a supervisor
    // has confirmed a held answer.
    check: function (input) {
      var kind = input.kind;
      var topic = input.topic;
      var answersToday = input.answersToday || 0;
      var confirmed = !!input.confirmed;

      if (answersToday >= this.dailyCap) {
        return {
          decision: "BLOCKED",
          reason: "Daily cap reached: " + answersToday + " answers given today, cap is " + this.dailyCap + ". Ask your supervisor for anything further today.",
          rule: "dailyCap"
        };
      }
      if (kind === "dose" || kind === "diagnosis") {
        return {
          decision: "BLOCKED",
          reason: "ASHA Guard never gives a medicine name, a dose, or a diagnosis. Ask your supervisor (ANM or medical officer).",
          rule: "noDoseNoDiagnosis"
        };
      }
      if (!this.allowlist.has(topic)) {
        return {
          decision: "BLOCKED",
          reason: "That topic is outside the approved protocol set. I only answer from the immunisation schedule and the danger-sign lists.",
          rule: "allowlist"
        };
      }
      if (kind === "symptom" && !confirmed) {
        return {
          decision: "NEEDS_CONFIRMATION",
          reason: "This symptom is not a listed danger sign, so it needs your supervisor (ANM) to confirm before any guidance.",
          rule: "confirmThreshold"
        };
      }
      return { decision: "ALLOWED", reason: "Passes all guard rules.", rule: null };
    }
  };
}

// ---------------------------------------------------------------------------
// Query classifier. Keyword matching only, fully transparent: the matched
// words are shown in the answer so the worker can see why the guard
// decided what it did. This is not a diagnosis, it is a lookup.
// ---------------------------------------------------------------------------

function containsAny(text, words) {
  for (var i = 0; i < words.length; i++) {
    if (text.indexOf(words[i]) !== -1) return words[i];
  }
  return null;
}

var DOSE_WORDS = [
  "dose", "dosage", "how much medicine", "which medicine", "what medicine",
  "give paracetamol", "give crocin", "antibiotic", "prescrib", "tablet",
  "syrup", "how many mg", "how much ml"
];
var DIAGNOSIS_WORDS = [
  "diagnos", "what disease", "what is wrong with", "what illness",
  "is it malaria", "is it dengue", "is it typhoid", "is it pneumonia",
  "is it covid", "what sickness"
];
var NEWBORN_SIGNS = [
  ["not feeding", "not feeding well"], ["stopped feeding", "stopped feeding"],
  ["convulsion", "convulsions"], ["fits", "fits"], ["seizure", "convulsions"],
  ["fast breathing", "fast breathing"], ["breathing fast", "fast breathing"],
  ["chest indrawing", "severe chest indrawing"],
  ["chest sinking", "severe chest indrawing"],
  ["fever", "fever"], ["hot body", "fever"], ["feels hot", "fever"],
  ["cold body", "low body temperature"], ["feels cold", "low body temperature"], ["hypothermia", "low body temperature"],
  ["lethargic", "lethargic"], ["unconscious", "unconscious"],
  ["not moving", "less movement than normal"],
  ["no movement", "less movement than normal"],
  ["umbilical redness", "umbilical redness"], ["pus from the cord", "pus from the cord"],
  ["yellow skin", "yellow skin"], ["yellow eyes", "yellow eyes"],
  ["jaundice", "yellow skin"], ["vomit", "vomits"], ["grunting", "grunting"],
  ["nasal flaring", "nasal flaring"], ["bulging fontanelle", "bulging fontanelle"],
  ["skin pustules", "skin pustules"]
];
var PREGNANCY_SIGNS = [
  ["bleeding", "severe vaginal bleeding"],
  ["severe headache", "severe headache with blurred vision"],
  ["blurred vision", "severe headache with blurred vision"],
  ["convulsion", "convulsions"], ["fits", "convulsions"],
  ["severe abdominal pain", "severe abdominal pain"],
  ["baby not moving", "reduced fetal movement"],
  ["baby moving less", "reduced fetal movement"],
  ["reduced fetal movement", "reduced fetal movement"],
  ["moves less", "reduced fetal movement"],
  ["fever", "fever"], ["swelling", "swelling of the fingers, face and legs"],
  ["difficulty breathing", "fast or difficult breathing"],
  ["breathless", "fast or difficult breathing"],
  ["leaking fluid", "leaking fluid"], ["too weak", "too weak to get out of bed"]
];
var CHILD_SIGNS = [
  ["vomits everything", "vomits everything"],
  ["unable to drink", "unable to drink or breastfeed"],
  ["not drinking", "unable to drink or breastfeed"],
  ["lethargic", "lethargic"], ["unconscious", "unconscious"],
  ["convulsion", "convulsions"]
];
var IMMUNISATION_WORDS = [
  "vaccine", "vaccin", "immunis", "immuniz", "schedule",
  "missed vaccine", "due", "birth dose", "booster"
];
var SYMPTOM_WORDS = [
  "cough", "cold", "rash", "diarrhoea", "diarrhea", "loose motion",
  "mild fever", "sore throat", "ear pain", "stomach ache", "vomiting",
  "headache", "tired", "weakness", "swelling", "pain"
];

function findSigns(text, table) {
  var found = [];
  for (var i = 0; i < table.length; i++) {
    if (text.indexOf(table[i][0]) !== -1 && found.indexOf(table[i][1]) === -1) {
      found.push(table[i][1]);
    }
  }
  return found;
}

function classifyQuery(raw) {
  var text = (raw || "").toLowerCase();

  var hit = containsAny(text, DOSE_WORDS);
  if (hit) return { kind: "dose", topic: "dose", matched: hit };

  hit = containsAny(text, DIAGNOSIS_WORDS);
  if (hit) return { kind: "diagnosis", topic: "diagnosis", matched: hit };

  var isPregnancy = text.indexOf("pregnan") !== -1 || text.indexOf("expecting") !== -1;
  var isNewborn = text.indexOf("newborn") !== -1 || text.indexOf("days old") !== -1 ||
    text.indexOf("week old") !== -1 || text.indexOf("month old") !== -1;

  if (isPregnancy) {
    var pSigns = findSigns(text, PREGNANCY_SIGNS);
    if (pSigns.length > 0) {
      return { kind: "danger", topic: "danger-pregnancy", matched: pSigns, group: "pregnancy" };
    }
  }
  if (isNewborn) {
    var nSigns = findSigns(text, NEWBORN_SIGNS);
    if (nSigns.length > 0) {
      return { kind: "danger", topic: "danger-newborn", matched: nSigns, group: "newborn" };
    }
  }
  var cSigns = findSigns(text, CHILD_SIGNS);
  if (cSigns.length > 0) {
    return { kind: "danger", topic: "danger-child", matched: cSigns, group: "child" };
  }
  var anyNewborn = findSigns(text, NEWBORN_SIGNS);
  if (anyNewborn.length > 0) {
    return { kind: "danger", topic: "danger-newborn", matched: anyNewborn, group: "newborn" };
  }
  var anyPreg = findSigns(text, PREGNANCY_SIGNS);
  if (anyPreg.length > 0) {
    return { kind: "danger", topic: "danger-pregnancy", matched: anyPreg, group: "pregnancy" };
  }

  hit = containsAny(text, IMMUNISATION_WORDS);
  if (hit) {
    return { kind: "schedule", topic: "immunisation", matched: hit };
  }

  hit = containsAny(text, SYMPTOM_WORDS);
  if (hit) {
    return { kind: "symptom", topic: "symptom", matched: hit };
  }

  return { kind: "other", topic: "other", matched: "" };
}

// Find the schedule row for an age mentioned in the text.
function findScheduleRow(text) {
  var t = (text || "").toLowerCase();
  var ages = [
    ["16 years", 8], ["10 years", 7], ["5 years", 6], ["5 to 6", 6],
    ["16 months", 5], ["16-24", 5], ["16 to 24", 5], ["24 months", 5],
    ["9 months", 4], ["9-12", 4], ["9 to 12", 4], ["12 months", 4],
    ["14 weeks", 3], ["10 weeks", 2], ["6 weeks", 1], ["birth", 0]
  ];
  for (var i = 0; i < ages.length; i++) {
    if (t.indexOf(ages[i][0]) !== -1) return NIS_SCHEDULE[ages[i][1]];
  }
  if (t.indexOf("pregnan") !== -1) return NIS_SCHEDULE[9];
  return null;
}

// ---------------------------------------------------------------------------
// Ledger. Every question, answer and block is recorded for audit. Stored
// on this device only, in localStorage. Nothing leaves the device.
// ---------------------------------------------------------------------------

var LEDGER_KEY = "ashaGuardLedger.v1";
var DAY_KEY = "ashaGuardDay.v1";

function todayString() {
  var d = new Date();
  return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
}

function loadLedger() {
  try {
    var raw = localStorage.getItem(LEDGER_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLedger(entries) {
  try {
    localStorage.setItem(LEDGER_KEY, JSON.stringify(entries));
  } catch (e) {}
}

function addLedgerEntry(entry) {
  var entries = loadLedger();
  entry.time = new Date().toISOString();
  entries.unshift(entry);
  if (entries.length > 500) entries = entries.slice(0, 500);
  saveLedger(entries);
  return entries;
}

function answersToday() {
  var entries = loadLedger();
  var today = todayString();
  var count = 0;
  for (var i = 0; i < entries.length; i++) {
    var d = new Date(entries[i].time);
    var day = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
    if (day === today && entries[i].decision === "ALLOWED") count++;
  }
  return count;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    createGuardPolicy: createGuardPolicy,
    classifyQuery: classifyQuery,
    findScheduleRow: findScheduleRow,
    NIS_SCHEDULE: NIS_SCHEDULE,
    DANGER_SIGNS: DANGER_SIGNS,
    ALLOWLIST_SOURCES: ALLOWLIST_SOURCES
  };
}
