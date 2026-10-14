# FLAZYN — EMAIL SYSTEM REBUILD (KLAVIYO MODEL) + FULL FRONTEND REVAMP

## THE FILES

Attached is a zip file containing the current codebase (frontend 
+ backend). Unzip it, read through it, understand the existing 
structure, routes, database schema, and how data currently flows 
— then do the work described below. When finished, package the 
entire updated project back into a zip file for me to download.

---

## PART 1 — REMOVE THE CURRENT EMAIL SYSTEM

Before building anything new, cleanly remove the existing email 
feature set:

1. Remove the current Email Templates, Email Sequences, Email 
   Flows, and Email Campaigns pages/routes/components from the 
   frontend
2. Remove their corresponding backend routes, controllers, and 
   database tables — but first check: does any OTHER working 
   feature depend on these tables or routes (e.g. does the lead 
   profile timeline reference email_templates)? If so, don't 
   break that — either migrate the dependency to the new system 
   below, or keep the underlying data table but rebuild the 
   interface and logic around it
3. Do NOT remove: SendGrid connection/credentials in .env, the 
   underlying email-sending capability itself, lead data, or 
   anything unrelated to the email feature specifically
4. Confirm the app still runs with no broken imports/routes after 
   removal before moving to Part 2

---

## PART 2 — BUILD A KLAVIYO-STYLE EMAIL SYSTEM

The client wants the email system rebuilt around Klaviyo's core 
model: behavior-triggered automated flows built on real customer/
lead data, not just static one-off sends. Build the MVP core of 
this properly rather than a shallow copy of Klaviyo's UI.

### 2.1 — Data Foundation

Every lead already has activity data in the CRM (source, stage, 
created date, last activity, file views, email opens if tracked). 
Confirm this data is queryable and available to the flow engine 
being built below — this is what triggers and segments run on, 
exactly like Klaviyo uses order/browse data.

### 2.2 — Segmentation

Build a segmentation feature: users can define a segment as a set 
of conditions against lead data, e.g.:
- "Leads with no activity in 7+ days"
- "Leads from Facebook with budget > X"
- "Leads currently in 'Interested' stage"
- "Leads who opened an email but didn't reply"

Segments should be:
- Savable and reusable by name
- Dynamic — automatically update as leads match/unmatch the 
  conditions over time, not a static snapshot
- Usable as the audience for both one-off Campaigns and as entry 
  triggers for Flows (below)

### 2.3 — Flows (the core feature — build this with real care)

This is Klaviyo's signature mechanic and the most important part 
of this rebuild. A Flow is a trigger-based automated sequence:

TRIGGER (what starts the flow):
- New lead created
- Lead enters a specific stage
- Lead enters a specific segment
- Lead tagged with X
- X days since last activity
- Lead source is X
- Manual — added by an agent

ACTIONS (steps inside the flow, connected visually):
- Send Email (choose/build the email inline)
- Wait (X hours/days)
- Condition / Branch (IF lead opened previous email → path A, 
  IF NOT → path B; IF lead replied → exit flow; IF lead moved 
  to Won/Lost → exit flow)
- Add Tag
- Change Stage
- Notify Agent
- (Send WhatsApp/SMS if those systems already exist in the 
  codebase — reuse them as action types here rather than 
  duplicating logic)

Build this as an actual visual, node-based flow builder — drag 
blocks onto a canvas, connect them with lines, branching paths 
literally fork visually. Reference Klaviyo's own flow builder as 
the functional model (not the visual style) — nodes connected by 
lines, a trigger at the top, branches expanding downward/outward.

Flow execution:
- Runs as a background job (use whatever job queue already exists 
  in the codebase — BullMQ if present) that checks on schedule 
  which leads are due for their next step
- Each lead's progress through a flow is tracked individually — 
  show, per flow, how many leads are at each step
- A flow can be turned on/off (Live/Draft/Paused) without deleting 
  it
- Real analytics per flow: entered, completed, converted (e.g. 
  moved to Won while in this flow), revenue/value attributed if 
  deal value is tracked

### 2.4 — Campaigns (one-off sends, simpler than Flows)

Separate from Flows — a Campaign is a single email sent once to a 
chosen Segment (or manually selected leads), either immediately 
or scheduled. Needs: audience picker (segment or manual), email 
composer/template picker, schedule now/later, and post-send stats 
(sent, opened, clicked).

### 2.5 — Email Builder

Build or rebuild a proper drag-and-drop email builder — blocks for 
text, image, button, divider, spacer, columns. Must produce actual 
responsive HTML emails, with a desktop/mobile preview toggle. 
Support the existing CRM variable system ({{first_name}} etc.) 
inserted into any text block. This builder is used both for 
one-off Campaign emails and for the "Send Email" action step 
inside Flows.

### 2.6 — Analytics

A dedicated Email/Flows analytics view: performance per Flow, 
per Campaign, per Segment — open rate, click rate, conversion 
rate, revenue/deals attributed where trackable. This should feel 
like Klaviyo's own analytics — attribution-focused, answering 
"did this automation actually make money/close deals," not just 
raw send counts.

### 2.7 — Rules

- No fake data anywhere — if a metric can't be genuinely tracked 
  yet (e.g. revenue attribution if deal value isn't stored), say 
  so clearly instead of showing a fabricated number
- Reuse the existing SendGrid integration for actual sending — 
  don't rebuild email delivery infrastructure, only the system 
  that decides what to send and when
- Test the full loop before considering this done: create a 
  segment → build a flow triggered by that segment → confirm a 
  real test lead matching the segment actually receives the first 
  email → confirm the wait/condition logic correctly determines 
  their next step

---

## PART 3 — FULL FRONTEND REVAMP (FULL CREATIVE AUTHORITY)

### Read this first

Two previous redesign attempts on this product failed. Not 
because the instructions weren't detailed enough — if anything, 
they were too detailed, too prescriptive, and the result still 
came out generic and uninspired. Overspecifying colors, spacing 
values, and component rules produced something that followed 
orders but had no soul.

This time, do the opposite. You have full creative authority. 
Stop treating this as a checklist to satisfy and start treating 
it as: you are the lead product designer at the best design 
studio in the world, and a client just told you "make our CRM 
the most beautiful, most impressive piece of software anyone has 
ever seen. Full budget, full trust, no committee, no notes. Just 
make it extraordinary. Better than anything else that exists in 
this category."

That's the brief. That's the whole brief.

### What went wrong before

The client's exact complaint, first: "This looks copied from 
Privyr — every button is in the same place Privyr puts it." A 
redesign was attempted. The client's reaction: "too bad, I don't 
even like it."

Read between the lines of that second reaction. It's not that the 
structure wasn't different enough from Privyr — it's that the new 
thing wasn't actually GOOD. Being different from Privyr was never 
the hard part. Being extraordinary was the hard part, and that 
got lost somewhere while chasing "different" as a goal in itself.

Different-but-mediocre is not the goal. Best-in-the-world is the 
goal. If it happens to look nothing like Privyr or any other CRM 
along the way — and it will, because genuinely great design is 
never a copy of anything — that's a side effect, not the mission 
itself.

### The only brief that matters

Design and rebuild a CRM web application that:

1. Looks like it belongs years ahead of every other product in 
   this category, not like a template
2. Would make someone screenshot it and say "how is this a CRM, 
   this looks like a $500M funded consumer product"
3. Feels like it was designed by one person with one strong, 
   coherent taste — not assembled from fifty different SaaS 
   pattern-library snippets stitched together
4. Is genuinely, provably faster and clearer to use than what 
   exists today — beauty in service of function, never decoration 
   for its own sake
5. Has real moments of "oh, that's clever" scattered through the 
   primary screens — details, interactions, layout choices nobody 
   else in this space would have thought of
6. Could not be beaten, matched, or out-designed by any competitor 
   looking at it. Set the bar so high that copying it would be 
   the only way to compete with it.

You have complete freedom over everything: color palette, 
typography, layout structure, navigation pattern, entire 
information architecture, where every single button/panel/tab/
control lives, motion and interaction design, and the overall 
personality of the product. Nothing is fixed, nothing is sacred, 
nothing needs to resemble any pattern from this codebase's 
current state or any other CRM on the market — including the 
new Email/Flows system built in Part 2, which must ALSO be 
designed to this same standard, not left in whatever default 
state it was functionally built in.

The only hard constraints, non-negotiable:
- Every existing feature must still work after the rebuild, 
  including everything built in Part 2 above
- Must work properly on desktop AND mobile — not desktop with 
  mobile as an afterthought
- Must remain genuinely usable by someone working fast under time 
  pressure. Extraordinary and usable are not in conflict — but if 
  you ever have to choose, choose usable.

### How to approach this

Don't start by listing components or writing a design-system spec 
document. Start by thinking like an actual designer:

- What is this product FOR, really? Not "a CRM" as an abstract 
  category — what does the actual DAY of the person using this 
  look like? What are they feeling when they open it: anxious 
  about follow-ups piling up, adrenaline from a deal about to 
  close, overwhelmed by too many leads? Design for that emotional 
  reality.

- If Flazyn were a physical object, what would it be? A cockpit 
  instrument panel? A trading floor terminal? A precision 
  instrument? Pick a metaphor that genuinely resonates and let it 
  discipline every decision across hundreds of screens so it all 
  feels like one coherent thing designed by one mind.

- What's the ONE page someone opens fifty times a day? Obsess 
  over that page more than any other. Make it the single best-
  designed screen in the entire product, then let everything else 
  inherit its DNA. The new Flow Builder from Part 2 is a strong 
  candidate for a second "hero" screen worth obsessing over — it's 
  the client's most-requested feature.

- Think about the best-designed software that exists anywhere 
  right now — not other CRMs specifically, but genuinely 
  exceptional products across every category — and understand WHY 
  they feel extraordinary, not just what they visually look like. 
  Bring that quality bar here, applied to something completely 
  original.

- Only then build the actual visual and structural language — 
  colors, type, spacing, shapes, navigation, exact button 
  placement, every micro-detail — as a CONSEQUENCE of those 
  decisions.

### Scope

Rebuild every single page in the application, top to bottom, no 
exceptions, no time limit — take as long as this genuinely needs. 
This includes every core app page, the new Segments/Flows/
Campaigns/Email Builder pages from Part 2, every integration/
automation sub-page, and the public-facing pages (login, signup, 
landing, pricing) so the very first impression already matches 
the extraordinary standard of the product itself.

Every page must be fully converted — nothing half-migrated to an 
old pattern sitting inconsistently next to new pages. One coherent, 
extraordinary product at the end.

### The test

When you think you're done with a page, do this honestly: imagine 
placing it next to the best-designed software you know of, from 
any category. If your honest reaction is "yeah, that's pretty 
good" — you are not done. The bar is: your reaction should be "I 
didn't know a CRM could look like this. This might be the best-
looking piece of business software I've ever seen."

If a page isn't hitting that bar, don't move on — keep pushing it 
until it does.

---

## DELIVERY

When finished:
1. Zip the entire updated project (all files, fully working) and 
   provide it for download
2. Confirm Part 1 (old email system removed cleanly) and Part 2 
   (Klaviyo-style Segments/Flows/Campaigns working end-to-end, 
   tested with a real lead) are both functionally complete before 
   focusing on Part 3's visual polish
3. Give a short summary of the overall design direction chosen 
   and why — the governing idea behind it
4. List every page that was rebuilt
5. Flag anything that needs real backend/infrastructure change to 
   fully support either the new email system or the new design, 
   rather than faking it

Full creative trust on the design. Precision and honesty on the 
functionality. Go build something nobody in this category has 
ever seen before.
