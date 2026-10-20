# Alignment review: Harness plan v0.6 against the SMART Gen 3 ASE pack

**Compared:** the Harness Gen 3 ASE strategy and plan (web app, v0.6, 20 Oct 2026) against the *SMART Gen 3 ASE App* document pack from Martin Neale (about 200 papers, current to 18 Oct 2026).
**Prepared:** 20 Oct 2026, for Lee Englestone. Internal only.

The pack's own rule is that it is a snapshot and the project is canonical, and none of its papers reports live status. Dates below are the pack's plan, not confirmed progress: check actual state (for example, whether M1 was met) before adopting them. Section references are to the pack's file numbers, such as 81 §4.

---

## 1. The biggest misalignments

1. **The plan does not follow the pack's build plan.** The current build plan is *81 Harness Build Project Internal v0.4* (18 Oct). It supersedes 78 for build scope and is mirrored by 82 and 83. It runs three lines from 1 Oct (Harness, estate, agent line), sized at 1,880 cycles, with milestones M1 (Oct) to M10 (Jul 2027). The plan sets its own dates and does not mention any of this.
2. **"V1.1 = Deploy / Manage / Enhance" does not exist in the pack.** In 81 §7, Deploy (Phase 2) and Manage/Enhance (Phase 3) are inside Harness **v1**. They are printed Nov–Dec, and v1 is accepted in **January 2027 (M4)**. A mid-December release to a friendly council would first have to clear the D7 halt (a customer-representative cloud architect's review) and v1 acceptance. Your "V1" may mean the current pre-production App Printer, so define it.
3. **The Harness lifecycle is Discover · Print · Deploy · Manage · Enhance.** The plan's six stages (Register → Contract → Package → Evaluate → Deploy → Operate) invent a new vocabulary, and V1.1 leaves out **Print**, the defining capability.
4. **Treatments are four fates: wrap · renovate · reprint · retire.** This is ruling A4 of 29 Sep, unchanged by 107. The plan's six actions come from the Estate Map app: Replace ≈ reprint, Consolidate ≈ absorb, and Retain has no canon equivalent. Underneath sit seven dispositions: reprint, wrap, remediate in form, absorb, drain, elevate, retire. There is also "print into the gap" where no system exists.
5. **A wrapper is defined by a seven-part spine: "all seven or it is not a wrapper".** The parts are signed manifest, capability façade (one MCP server per app), identity binding, audit relay, gated writes, drift quarantine and event emitter, with four write classes. The **statutory** class is never available to a synthetic worker, even with human confirmation. The plan's own wrapper contract (outbox, idempotency, outcome-unknown) is not the canon one.
6. **Wrapper numbers and sequence are far apart.** The pack has Tier 1 wrapper #1 (Microsoft 365 / Power Platform) at Level 1 in **March 2027** and three by May. The plan has 10 by Q1. The pack's rule is that treatment does not start before the register exists, and Tier 3 (first wraps) is never sold before Tier 2.
7. **Synthetic workers are defined differently.** Canon (107, agreed 18 Oct):
   - "Synthetic worker" is the customer-facing umbrella for any AI agent doing a job, and "agent" stays internal.
   - The named kinds are synthetic software workers (specifier, architect, printer, tester), the synthetic concierge, synthetic specialists, transformation synthetic workers, and **the roster of 304 synthetic workers**. The 304 is never rounded, and no roles may be listed until the roster paper exists.

   In 81 §15, building synthetic workers is "scope to be planned, not scheduled". The prerequisites (artefact classes, governed catalogue, calibration gates) land Feb–May 2027. The plan's three workers by 7 Nov run ahead of that.
8. **The four surfaces are not products.** Front Door AI, Workforce AI, Transformation AI and Harness AI are *surfaces*. The products are:
   - Front Door AI: the concierge, the specialist phone service and the **SMART Customer Services Unified AI Workdesk**.
   - Workforce AI: the **SMART Staff AI Workdesk** (Staff Copilot renamed).
   - Transformation AI: the **SMART AI Transformation Workbench**.
   - Harness AI: the **SMART Harness**.

   The plan has no Workdesk at all. It also describes Workforce AI as "staff assistants as worker tools", which is not canon.

## 2. Wording and names to correct

| The plan says | The pack says | Source |
|---|---|---|
| Wrap / Renovate / Replace / Consolidate / Retire / Retain | wrap · renovate · reprint · retire (plus the seven dispositions) | 107 §5; 55 §1, §3 |
| App Register (held by the Harness) | **estate register**, held in the Transformation Workbench and built by the Harness instruments | 54 §2; 17 §6.1 |
| Register → Contract → Package → Evaluate → Deploy → Operate | Discover · Print · Deploy · Manage · Enhance | 15 §4 |
| V1 → V1.1 (Deploy, Manage, Enhance) | v1 = Phases 1–3 (Print, Deploy, Manage/Enhance), accepted Jan 2027; V2 adds Discover (the estate unit) | 81 §7; 15 §1 |
| "Role-based agents" | "synthetic workers" customer-facing; "agent" internal only | 107 §5 |
| Workforce AI = staff assistants that become worker tools | Workforce AI surface → Staff AI Workdesk product → roster of 304 synthetic workers; tools are capabilities apps expose | 107 §4; 42 §5.3 |
| Transformation AI = the CEO's SME engine | Transformation AI = the Workbench plus transformation synthetic workers. "Research and SME Spec" is the specifier stage inside the Harness print line | 107 §4; 16 §5 |
| Smart Notes, Document extraction assistant, Checking and calculation assistant | Estate Map touchpoint labels, to be reconciled before any external showing. The product edition is **Meeting Notes** (not built) | 108 §4.1; 18 §4 |
| Front Door = resident and contractor entry point that opens cases in Harness apps | Residents and advisers; cases open in the Workdesk record; service apps stay with their owners, wrapped for the "slice". Partners/contractors need the "partner floor", which is not built | 106; 95 §10 |
| Named human confirms each worker decision | Reads are free within declared scope; validated writes need no human; human-confirmed is one write class; **statutory writes are never available to a worker** | 56 §3.5; 57 §4.1 |
| "Measured like staff" | Capacity is never a budget saving, and no individual is measured | 42 §7.2; 104 |
| Workdesk / work desk | "Workdesk", one word | 107 §5 |
| Owners as named people | Owners as roles, with a blank column for names | 78 §1, §24; 81 §1 |

## 3. What is missing, by initiative

### H. SMART Harness

- **High:**
  - The milestone spine M1–M4. The M1 (Oct) items are:
    - build spec v2.0 and the cycle & timings spec
    - open decision records closed
    - agent-line capability paper
    - three certified lines running
    - print-economics ledger reporting from the first print
  - The four halts (after D3, after the first D16 wave, before D7, before D14).
  - The **Level 1 conformance runner**. Level 0 output "cannot be marketed as SMART".
  - The **injection corpus** run green (a batch-1 blocker).
  - **SMART Token Exchange** (built but not enacted; due Jan 2027).
  - The **run service** (Run, RunJournal, Referral).
- **High:** a quality standard for the definition of done:
  - the **SMART application standard** (seven properties)
  - the six-rung **governance ladder**
  - the public **Twelve-Question Test**, which ICS takes first
  - the acceptance probes P-D0–P-D10 and the S-1 to S-5 rehearsals (including the rebuild-from-provenance drill, diff = zero)

  Sources: 77 §5, §12, §14; 16 §9; 83 §2.4.
- **Medium:** Deploy detail.
  - Infrastructure-as-code landing zone. Canon: "Deployment is a product capability, not a professional-services activity".
  - Consent ceremony, with revocation always visible.
  - Contracts compiled to Azure Policy (UK-only, deny out-of-band change).
  - Staging → UAT gate → production, with post-deploy probes and rollback.
  - DR-01: one Harness per customer tenant, plus an ICS "harness of harnesses".
  - Source: 03 tech spec §A2, A5, A6.2; 04 §4.
- **Medium:** Manage and Enhance detail.
  - Drift detection and an attention centre.
  - Impact assessment, fleet enhance.
  - Template authority per line, product vs starter templates (DR-18), Tier 1 / Tier 2 control, no customer-to-customer sharing.
  - Source: 04 §5–6a; 42 §5.6, §9.
- **Medium:** "Customer self-service requests". Canon is the **demand loop** (unmet-need records, sketch clusters, a named human decision). Long-tail printing goes to certified client operators; wrappers and first-of-type work stay ICS-operated (42 §4.5; 77 §16).
- **Medium:** AIT Workbench v0 as "the second proof point" (realisation accepted in November, M2).

### A. Estate Management

- **High:** the **Discover** instruments.
  - **SMART Estate Discovery** (the census) and the **SMART App Scanner** (one app at a time; "no charter, no scan").
  - Six separately consented sweeps.
  - The corroboration rule: two independent routes, or a named human signature.
  - Source: 54 §2–4; 17 §2.
- **High:**
  - The **auto-renewal freeze** as the first act (it "usually pays for the census").
  - Commercial fields: break date, notice period, auto-renews.
  - Source: 54 §3; 17 §6.3.
- **High:** **duty coverage** as the headline metric: at least 90% of 137 statutory duties naming a confirmed system (54 §6.1; 58 G3).
- **High:** the three discovery spikes (20 days). Classification recall >0.80 at precision >0.70 "decides whether the product exists". Also a Graph budget for a 3,000-user tenant, and ITSM extraction precision >0.85 (Harness_V2_-_10 §5).
- **High:** engagement gate S0. A signed DPIA and every access line granted *and tested* before the first call. The council commits 54 days. A late Nov–Dec discovery run with one council has none of this, and Tier 1 alone takes four weeks across Christmas (Harness_V2_-_08 §7; sheet 09).
- **High:** boundary **B6** threat model (DEC-15). There is no grade-3 read against a production system of record until B6 is threat-modelled (17 §5; 81 §11).
- **High:** a **per-vendor permissions register**, seeded from the Top-250 vendor index: 103 vendors, 15 prohibit (including NEC and Unit4), 65 silent. Also the operating standards S1–S8, and dedicated licensed accounts per agent (56 §9; 81 §2, §12; 59 §7).
- **Medium:**
  - Register data model (17 §6.1): EstateApplication, DiscoveryEvidence, Vendor/VendorPermission, CommercialPosition, Disposition, RegisterCoverage.
  - Bi-temporal, append-only observations with confirmation decay.
  - Ladder position; readiness state (Provisioned → Ready / Degraded / Quarantined).
  - Published classification precision/recall and a coverage statement.
- **Medium:** engagement tiers.
  - Tier 1 Evidence Baseline: 4 weeks / about 88 days.
  - Tier 2 Full: 12 weeks / about 305 days, 10 people.
  - Tier 3: +8–10 weeks / about 250 days, first three wraps.
  - Gates G0–G4. The Workbench is handed over running at week 12.
  - First engagement with a new client type costs 1.5–1.7× effort.
  - Source: 58; Harness_V2_-_08; sheet 09.
- **Medium:**
  - Allocate the legal risk between ICS and the council (who warrants licence compliance).
  - Pick one posture on notifying suppliers. The legal briefing advises seeking acknowledgement; S7 says seek no permission the contract does not require.
  - Source: Agentic_RPA §7; 56 §9.2.
- **Low:** exports. CAF A3 pack, CDDO legacy-register return, information asset register (IAR) feed.

### S. Synthetic Workers

- **High:**
  - Align to 107: the named kinds and the roster of 304.
  - The plan's three "workers" (extraction, checking, reporting) are task assistants, not council roles.
  - Do not create a separate "worker catalogue". That name collides with the **governed catalogue**, which holds capabilities.
- **High:** agent-line prerequisites before any shadow run. The pack scores the agent line at 4 built, 10 partial, 19 missing of 33 (21 §4).
  - Studio (authoring) and run service.
  - Per-agent licensed identity.
  - Sketch · Practice · Print tiers (sketches never take consequential actions).
  - Calibration per agent × model version ("no production run on an uncalibrated profile").
  - Evaluation sets, version, hash and revocation path.
- **Medium:** worker spec anatomy: skill (trigger, procedure, tools, grounding, guardrails, evaluation set, provenance), identity, grounding scope, named owner (95 §12.1).
- **Medium:** follow-on papers owed: the 304 roster paper, a Synthetic Workforce paper and a specialist phone service note (108 §4.2).

### P. The four surfaces

- **High:** add the Workdesks.
  - **Customer Services Unified AI Workdesk** (Front Door). It wraps service apps for the slice rather than reprinting them.
  - **Staff AI Workdesk** (Workforce AI). Staged: v1 extended through Harness cycles first, then a full v2 reprint surfacing the 304.
  - Source: 104; 106; 18 §26.
- **High:** Front Door phasing (95 §14).
  - **Wave 0 (now to Dec 2026): "Nothing in this wave is a print".**
  - Wave 1 (Jan–Mar 2027): Exchange live, Tier 1 wrappers, Staff Workdesk batch 1 (Mar–Apr).
  - Wave 2 (Apr–Jun 2027): Front Door on the Exchange hop (May), first concierge journeys (missed bin, council tax), first specialist (council tax), ASC pathfinder.
  - The calendar rule: nothing is shown live before it is printed.
  - The plan's "Front Door packaged and deployed Nov–Dec" and "contractor submission demo mid-Dec" conflict with this.
- **High:** priority services.
  - App blueprints CT1 Council Tax, BF4 Blue Badge, RC1 Registrations, WR1 Household Waste, SS2 Fly-tipping (99a–e).
  - Starter packs A/B/C, then about 8 services a quarter (98 §6.2).
  - The Front Door "recovery seven".
- **Medium:**
  - Transformation AI: Workbench editions (LGR, HE, FE), transformation synthetic workers, the value ledger.
  - The Harness ↔ Workbench register interface (feed, confirmation, disposition write-back; Feb 2027).
  - The **Licence Optimiser** (a Workbench module built on the agent line: seven engines, four waves).
- **Medium:** the customer-services launch milestone. The pack is ambiguous between an October and a November launch (95 §20.1; 72 I7; 108).

### G. Golden journey

- **Medium:** building compliance certificate validation is not the pack's pathfinder. That is **ASC financial assessment** (DEC-04): special-category data, two mandatory human gates, grade 3 on a non-production instance in **April 2027 (M7)**.
  - Keep building compliance as a demo journey, or move the golden journey to ASC. This needs a decision.
  - Either way, use the ASC design pattern: consent and lawful-basis gate first, then process map, parties, sources and benefit model as spec cycles. Add a DPIA input.
  - Any value claim needs a class, baseline and owner, plus the sentence "The estate front at scale awaits its first proof point".

### Missing across the plan

- **High:** a **decision register**. 81 §17 lists 22 decisions the build waits on, ten due in October. Several now look overdue:
  - DEC-14: the pilot ("pathfinder") council tenant and its written data agreement, with a synthetic fallback.
  - DEC-03: Token Exchange sequencing.
  - DEC-16: write transport.
  - DEC-04: Tier 1 order.
  - DEC-26: open v1 decision records.
  - DEC-06: estate survey vs Tier 1 Evidence Baseline.
  - DEC-08: the Workbench as two products or one with editions.

  The Front Door paper adds 24 more (95 §21), and 108 §4.1 has 13 open items.
- **High:** **metering and the commercial record** (commercial model v3.0 §12; 30 §A7). These are delivery requirements, not sales ones:
  - line-time per job; quoted vs actual by form × tier
  - pattern vs first-of-type
  - **lines per operator** weekly (target 2.0 within two quarters)
  - cloud and model cost per line-day
  - a shadow cost meter on the first five engagements
  - "citizens under management" count and distance to the next band
  - agent run metrics (runs, tokens per run, referrals per 100 runs, recalibration days, Sketch → Print conversion)
- **High:** **rules the platform must enforce**:
  - no client-operated line without a registered pattern
  - tier-1-writing agents are ICS-operated
  - jobs stop at a 10% overrun
  - every approval names what it retires or takes on
  - the pattern register is entered only after a live client app
- **High:** **commercial readiness** before any friendly-council release:
  - the commercial model is unsigned
  - a Harness Licence is required while any app is live
  - first-time organisation types are sold as co-development, not fixed price
- **High:** the **estate-front proof point** as a milestone ("the most important commercial event ahead of us"). Evidence wanted: drift-event rate, re-verification time for a wrapped vendor system, capacity-to-cash rate.
- **Medium:** a risks register (81 §19, 14 risks), the contradictions list (81 §18), and the cadence: weekly line report, monthly SLT review, quarterly re-baseline.
- **Medium:** the pack's status vocabulary: not started · in flight · at a gate · done · struck.
- **Low:** frameworks. G-Cloud 14 expires 28 Oct, the pack claims G-Cloud 15 is listed [V], and the Public Sector Software framework is due 28 Feb 2027. Also legal review of the top five vendor agreements.

## 4. The pack's timeline, for reference

| When | Milestone (81 §4 unless stated) |
|---|---|
| Oct 2026 | M1: build spec v2.0; open decision records closed; agent-line capability paper; three certified lines; print-economics ledger reporting |
| Nov 2026 | M2: v1 Phase 1 (Print) printed; AIT Workbench v0 accepted (second proof point); run service (Run, RunJournal, Referral); Scanner core spine |
| Dec 2026 | M3: v1 Phases 2–3 (Deploy, Manage/Enhance) printed; D7 cleared; Level 1 runner live; injection corpus green; Discovery Wave 0 exit; read binding families 1–4 |
| Jan 2027 | M4: v1 accepted; lines cut over; Token Exchange live; Discovery Wave 1 exit; identity fabric, OLM, estate stream |
| Feb 2027 | M5: the wrapper's seven-component spine; classification gate published; Harness ↔ Workbench register interface |
| Mar 2027 | M6: Tier 1 wrapper #1 (Microsoft 365 / Power Platform) at Level 1; ladder engine; Workbench v1; governed catalogue; pen test passed |
| Mar–Apr 2027 | Staff AI Workdesk batch 1 (95 §14) |
| Apr 2027 | M7: ASC system of record wrapped at grade 3 (non-production) |
| May 2027 | M8: second vendor wrapper; Manage live; Front Door on the Exchange hop (95 §14) |
| Jun 2027 | M9: fleet mechanics; ASC financial-assessment agent team; first concierge journeys and first specialist (95 §14) |
| Jul 2027 | M10: re-baseline (gate contingency) |

## 5. Do not put these in the plan app

- **Rates, bands, margins and floors.** Licence bands, print-day rates and survey prices are barred "in internal assets or external ones" until the commercial model is signed (35 §2).
- **Unsupported numbers.** Do not quote the do-not-quote figures (15 §13). The roster's individual roles stay unlisted until the roster paper exists.
- **Exchange as live.** Describe the Token Exchange as intent, not live (60 §10).
- **Anything shared outside ICS.** Run it through the five-question quality gate (35 §8) and use customer vocabulary.

## 6. Questions to settle with Martin

1. Does the plan adopt 81 v0.4 as its spine, or sit alongside it as the near-term demo and adoption plan?
2. What is "Harness V1" in the plan: the pre-production App Printer or canon v1? Is there a "V1.1" at all?
3. Is the golden journey building compliance, or ASC financial assessment (DEC-04)?
4. Where does the CEO's "SME engine" sit: in the Harness specifier stage ("Research and SME Spec"), in the Transformation Workbench, or both?
5. "Demonstrate ASAP" against "nothing shown live before it is printed" and "no SMART application before a Level 1 run". What may be shown, to whom, and how is it labelled?
6. Who owns the plan's initiatives? The pack uses roles, and Lee Englestone is not named in it.
