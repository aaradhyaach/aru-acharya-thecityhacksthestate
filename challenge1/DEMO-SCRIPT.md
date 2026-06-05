# 🎤 Demo Script — Challenge 2 (3 Minutes)

## Opening (15 seconds)

> "A work order says *'room too hot.'* That tells you nothing. A student says *'Room 304 has been above 80 degrees for three days, kids are getting headaches, and the teacher propped open the fire door.'* That's the signal that makes it actionable."

## Part 1: The Dashboard (30 seconds)

**Show the Challenge 1 dashboard.**

> "Here are the three active work orders for 345 East 15th Street — a school building in Manhattan. Annual steam inspection, electrical panel maintenance, emergency exit sign testing. These are scheduled tasks. They look fine on paper."

**Click into one — the Emergency Exit Sign test.**

> "But look at this work order. Short description. No location detail. No field confirmation. No evidence. If this failed, who would know?"

## Part 2: Student Signal Intake (45 seconds)

**Click "Student Signal" to open the new tool.**

> "This is where the student becomes the sensor."

**Type this exact input:**

> `The emergency exit sign by the gym on the 2nd floor has been flickering for two weeks and last night it was completely off. The stairwell was totally dark.`

> "One sentence. No form fields. No dropdown menus. Just truth."

**Hit Submit.**

## Part 3: AI Structuring (45 seconds)

**Show the structured output appearing:**

> "The system immediately extracts: 
> - **Issue type:** Emergency lighting / egress
> - **Location:** 2nd floor, stairwell near gym  
> - **Severity:** Critical — this is life safety
> - **Asset:** Emergency exit sign, battery backup
> - **Urgency:** Same day — dark stairwell = egress violation
> - **What's missing:** Photo, battery test date, are other signs affected?"

> "This isn't a chatbot generating text. This is turning lived experience into operational intelligence."

## Part 4: Public Data Enrichment (30 seconds)

**Show the enrichment panel:**

> "The system checks real NYC DOB records for this building. It finds:
> - A **2022 blocked egress complaint** that resulted in a stop work order
> - A **2018 elevator failure** where disabled students had to take stairs
> - **Active construction complaints** from May 2026
>
> This isn't a link dump. It's context: *this building has a pattern of egress and accessibility issues.* A flickering exit sign isn't just maintenance — it's connected to building history."

## Part 5: Workflow Recommendation (30 seconds)

**Show the workflow output:**

> "The system generates what to do Monday morning:
> 1. Inspect 2nd floor exit signs — check battery backup
> 2. Verify all egress lighting in stairwells
> 3. Escalate: egress + life safety = FDNY compliance territory
> 4. Link to existing work order for emergency lighting test
> 5. **Ask the student if it's fixed** — don't just close the ticket"

## Closing (15 seconds)

> "The work order said *'test exit signs.'* The student said *'the stairwell was totally dark.'* One is a task. The other is truth. We built the tool that captures that truth and turns it into action."

---

## Tips for Delivery

- **Don't read the screen.** Tell the story while the demo runs.
- **Pause after the AI output appears.** Let judges read it.
- **The strongest line:** "A work order is a record of what someone managed to capture. The real signal starts in the field."
- If asked about the AI: "It's rule-based keyword extraction plus structured output — no LLM API required. But the architecture supports dropping in GPT/Claude for richer analysis."
- If asked about the public data: "That's live NYC DOB data for BIN 1020419 — queried today from the Building Information System."
