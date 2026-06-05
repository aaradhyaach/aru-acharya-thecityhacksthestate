# 🎤 The Student Signal — Full Pitch + Explanation Guide

## The One-Liner

> "We built the tool that turns a student's lived experience into operational intelligence — connecting what people see in buildings to what maintenance teams need to act."

---

## 🏆 3-MINUTE DEMO PITCH

### MINUTE 1 — The Problem (Signal)

*[Show the Dashboard]*

"This is 345 East 15th Street — a real school building in Manhattan with 100 registered assets. Steam systems, electrical panels, elevators, emergency lighting.

Here are the three active work orders from CriticalAsset. Look at this one: *'Perform mandatory emergency exit signage and battery unit discharge test.'*

That's a maintenance task. It tells you WHAT to do. It doesn't tell you what's ACTUALLY happening in the building right now.

But a student does.

A student says: *'The exit sign by the gym on the 3rd floor has been completely dark for two weeks. The stairwell is pitch black during fire drills.'*

That's not a complaint. That's intelligence. That's the signal that makes this work order urgent — because now you know lives are affected."

*[Click "⚡ Student Signal"]*

---

### MINUTE 2 — The Product (Intelligence)

*[Type the observation, hit Analyze]*

"One sentence. No forms. No dropdowns. Just truth.

Watch what happens. The system extracts:
- **Issue type:** Emergency lighting failure — fire & life safety
- **Location:** 3rd floor stairwell B
- **Severity:** Critical — this is egress illumination
- **Confidence:** Each field is labeled — Verified, Likely, Inferred, or Missing

We don't fake certainty. If AI guesses, we say it guessed."

*[Click to Enrichment]*

"Now the system checks real NYC public records. These aren't simulated — this is data we pulled today from the NYC Department of Buildings for BIN 1020419:

- 2022: A **blocked egress** complaint led to a Stop Work Order
- 2018: **Both elevators failed** — disabled students had to take stairs
- 2025: Construction debris fell on an adjacent roof
- May 2026: Two **active complaints** right now for failure to maintain

This building has a *pattern* of egress and accessibility issues. A dark exit sign isn't just maintenance — it's connected to history."

---

### MINUTE 3 — The Action (Decision)

*[Show Workflow]*

"The system generates what to do Monday morning:
1. Dispatch to 3rd floor stairwell B within 4 hours
2. Battery discharge test — if it fails, replace within 24 hours per NYC Fire Code
3. Survey all exit signs in the stairwell — pattern suggests batch failure
4. Document for FDNY compliance
5. Escalation triggers if multiple signs are out

Then — and this is the most important part:"

*[Show Record to CriticalAsset]*

"We push it back into the system. Update the work order. Link the room. Link the asset. Add the evidence. Flag what's missing. Recommend inspection."

*[Show Closure]*

"And 72 hours later, we ask the student: *Did this actually get fixed?*

If they say 'still broken' — the ticket re-opens and escalates. If they say 'worse' — it goes straight to the building manager.

The work order doesn't close until reality changes."

---

**CLOSING LINE:**

> "A work order is what someone managed to capture. A student signal is what's actually happening. We built the tool that makes the system listen — and the student the proof that it worked."

---

## 📋 EXPLAINING THE PRODUCT (for Q&A)

### "What does it do?"

It's a two-part tool:
1. **Dashboard** — connects to CriticalAsset's API, pulls live work orders for a building, shows what's scheduled
2. **Student Signal** — lets building occupants report what they actually experience, then uses AI to structure it, enriches it with NYC public records, generates a workflow for operators, and writes it back into CriticalAsset

### "What makes it different from a complaint box?"

Three things:
1. **AI structures the input** — a student writes one sentence, the system extracts 11 operational fields (issue type, severity, asset, root cause, missing info, next action)
2. **Public data makes it credible** — we pull real DOB violations, 311 complaints, and compliance context so the operator sees history, not just a single report
3. **Closure verification** — the student confirms whether the fix worked. This prevents false closures and keeps the system honest.

### "Is the AI real?"

For the hackathon, we built rule-based keyword extraction that identifies issue types, locations, severity, and asset categories from natural language. In production, this would plug into an LLM (GPT, Claude) for richer analysis — but the architecture is the same. The point isn't the model — it's the pipeline: signal → structure → enrich → act → verify.

### "Is the data real?"

Yes:
- **Work orders:** Live from CriticalAsset staging API (authenticated via GraphQL)
- **Assets:** 100 real registered assets (steam valves, switchboards, exit signs, pumps, etc.)
- **NYC DOB data:** Pulled today from a810-bisweb.nyc.gov for BIN 1020419 — real complaint numbers, real dates, real descriptions
- **Building:** 345 East 15th Street, Manhattan, Block 922, Lot 8, 5-story school building

### "What's the confidence label system?"

Every AI output field is tagged:
- ✅ **Verified** — came directly from CriticalAsset data or student's explicit statement
- 🔵 **Likely** — strongly supported by context
- 🟣 **Inferred** — AI's best guess based on patterns
- 🔴 **Conflicting** — data disagrees (e.g., ticket says resolved, student says it's not)
- 🟡 **Missing** — critical info we don't have yet
- ⚪ **Needs Inspection** — can't be determined without physical verification

This matters because: **if AI guesses, we say it guessed.** We don't fake certainty.

### "How does it connect to CriticalAsset?"

- **Authentication:** OAuth2 Client Credentials (GraphQL mutation) + user login fallback
- **Read:** workOrders, assets, locations queries
- **Write:** createWorkOrder mutation to push student signals back as new tickets
- **Endpoint:** `https://345e15.stg.criticalasset.com/api` (Apollo GraphQL)

### "What's the tech stack?"

- **Backend:** Node.js + Express (handles auth, proxies API, AI structuring, enrichment)
- **Frontend:** Vanilla HTML/CSS/JS (no React, no build step — instant demo)
- **Data:** CriticalAsset GraphQL + NYC Open Data (DOB BIS)
- **Deployment:** `npm start` → runs on localhost:3000

### "What would you build next?"

1. **Photo upload + OCR** — student takes a photo of the broken sign, AI reads the model number
2. **Real LLM integration** — GPT-4 for richer structuring and natural language workflows
3. **Push notifications** — student gets alerted when their report triggers action
4. **Building-wide analytics** — aggregate student signals to find systemic patterns
5. **Multi-building portfolio** — operators manage 25 school buildings from one dashboard

---

## 🎯 JUDGING CRITERIA MAP

| Criterion | Points | Where We Address It |
|-----------|--------|---------------------|
| Product clarity (user, problem, action) | 20 | Dashboard → Signal → Workflow → Closure |
| Quick starter (connect, pull, dashboard) | 15 | Live API auth + 3 work orders + counters |
| CriticalAsset integration (make record better) | 15 | Record panel pushes 6 updates back |
| Student signal + AI | 15 | One-sentence intake → 11 structured fields |
| Public evidence | 10 | Real NYC DOB complaints with implications |
| Confidence model | 10 | 6-level labels on every field |
| Usability | 10 | Unified light theme, mobile-first, one-click flow |
| Demo | 5 | Scripted 3-min narrative with live data |

---

*Good luck. You've got this. 🏆*
