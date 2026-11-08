# ASHA Guard

India's roughly one million ASHA workers carry frontline health care to villages on paper registers, so the advice a family gets depends on which worker visits and what she remembers, and a wrong answer about a danger sign can cost a mother or a newborn her life.

ASHA Guard is a guarded assistant for an ASHA worker. The worker types a household situation, a newborn with a fever, a missed vaccine, a pregnancy danger sign. The assistant answers only from a fixed, sourced protocol set: the Indian National Immunisation Schedule and the WHO danger-sign lists. It never guesses, never diagnoses, and never gives a medicine name or a dose.

Live demo: https://tydavid5.github.io/asha-guard/

## How the guard works

The policy engine adapts the spending-policy pattern (per-call and daily caps, allowlist, confirm threshold, ledger) to health answers:

- **Allowlist of sources.** Answers come only from the three sources listed below. Nothing else can be cited.
- **No dose, no diagnosis.** Any request for a medicine name, a dose, or a diagnosis is blocked and sent to the worker's supervisor (ANM or medical officer).
- **Danger signs are never gated.** A danger sign gets an urgent referral at once, with no confirmation step in the way.
- **Confirm threshold.** A symptom that is not a listed danger sign needs the supervisor to confirm before any guidance is given. In demo mode that confirmation is simulated and labelled as such.
- **Daily cap.** 50 answers a day. Past the cap, the guard blocks further answers and sends the worker to the supervisor.
- **Ledger.** Every question, answer and block is recorded with the time, the decision and the rule that applied. The ledger lives on the device only and can be downloaded as JSON.

## Try it

Open the live demo and try the example questions on the Ask tab. Each one shows a different guard decision:

- "My baby is 6 weeks old. Which vaccines are due today?" (allowed, schedule answer)
- "Newborn, 10 days old, not feeding well and feels hot." (allowed, urgent referral)
- "A pregnant woman, 7 months, has a severe headache and blurred vision." (allowed, urgent referral)
- "What medicine should I give for a baby's fever, and how much?" (blocked, no dose rule)
- "A child missed the 14-week vaccines. What now?" (allowed, schedule answer with catch-up note)
- "What is the weather today?" (blocked, outside the allowlist)

## Protocol sources

Every fact in the app comes from one of these, and the app cites its source in each answer:

- National Immunisation Schedule, Ministry of Health and Family Welfare, Government of India: https://nhm.gov.in/New_Updates_2018/NHM_Components/Immunization/report/National_%20Immunization_Schedule.pdf
- IMNCI danger signs (WHO and UNICEF), young infant and child: https://theory.pedianotes.in/social-pediatics/integrated-management-of-neonatal-and-childhood-illness-imnci/
- Neonatal danger signs as recommended by WHO and UNICEF: https://www.ovid.com/jnls/jfmpc/fulltext/10.4103/jfmpc.jfmpc_1542_22
- WHO Pregnancy, Childbirth, Postpartum and Newborn Care (2015), nine pregnancy danger signs, via: https://link.springer.com/article/10.1186/s12884-017-1628-6
- ASHA workforce, about 10 lakh (1 million) workers under the National Health Mission: https://www.telegraphindia.com/india/new-labour-codes-exclude-anganwadi-asha-and-midday-meal-workers-from-welfare-cover-prnt/cid/2139152
- Universal Immunisation Programme scale, about 27 million infants and 30 million pregnant women each year: https://www.business-standard.com/health/india-universal-immunisation-programme-2025-vaccine-access-coverage-125042500520_1.html

## Scale and severity

- About 10 lakh (1 million) ASHA workers serve under the National Health Mission, the world's largest community health worker programme.
- The Universal Immunisation Programme targets about 27 million infants and 30 million pregnant women every year.
- The problem is the gap between that scale and the paper register: advice quality depends on one worker's memory, and a missed danger sign is a missed chance to refer.

## Run it

No build step, no dependencies, no server needed.

```
# Serve locally
python3 -m http.server 8000
# then open http://localhost:8000
```

Or open `index.html` directly in a browser. All data stays on the device, in local storage. There are no accounts and no patient records.

## Honest limits

- This is a demo. Answers are simulated lookups from a fixed protocol set, not a live medical service.
- It does not diagnose, does not name medicines, and does not give doses.
- It only knows the immunisation schedule and the danger-sign lists. Anything else is refused.
- It is not a substitute for an ANM, a medical officer, or a health facility.
- The demo has no real users and no real deployment data yet. Usage counts, if reported, will be real counts from the live demo, not estimates.
- Built as a standard static web project so it can be imported into an AgentFoundry IDE project. An AgentFoundry account was created for 0x5ive@gmail.com, email confirmation pending, and the IDE import is the next step.

## Hackathon

Built for the Code for a Billion: Bharat Agentic AI Hackathon 2026, Health track. Submissions close November 15, 2026. License: MIT.

## Credits

Policy engine pattern adapted from the author's earlier guarded-agent work. Immunisation content draws on the public National Immunisation Schedule and the author's Interactive Immune Response Simulator (https://github.com/tydavid5/immune-response-simulator).
