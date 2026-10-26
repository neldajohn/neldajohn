# Reported facts vs. guesses

McKinsey publishes almost nothing about Solve's mechanics or scoring. This file tracks where each detail in the simulator comes from, so it can be updated as new candidate reports appear. Every number lives in `src/config.ts`.

Legend: **R** = candidate-reported (prep-provider write-ups, Oct 2026) · **G** = guessed / practice-model choice · **C** = conflicting reports, configurable.

## Sitting
| Detail | Source | Where |
|---|---|---|
| 65 / 85 / 95-minute invites and game order | R | `CONFIG.modes` |
| Clocks 35 / 30 / 20 / ~30 min | R (SFL Island ~30 is approximate) | `CONFIG.clocks` |
| Untimed tutorials; clock starts after | R | `Tutorial.tsx` |
| Quirk: tutorial ends unannounced with clock running | R (some candidates) | Settings toggle; 60 s auto-end is **G** |
| Unused time does not carry over; no re-entry | R | `store/sitting.ts` |
| Closing the tab forfeits the attempt | R | abandon detection on boot |
| End screen shows no score | R | `EndScreens.tsx` |

## Red Rock
| Detail | Source |
|---|---|
| Investigation ⇄ Analysis → Report (one-way) → 6 cases on one 35-min clock | R |
| Research Journal drag-in, rename/reorder/delete, duplicates blocked | R |
| No calculator during Investigation; calculator with history in Analysis | R |
| ~Half the material is noise | R |
| 2–4 questions, sub-parts, two decimal places, answers cascade into Report | R |
| Report: 8–10 blanks, graph type locked once chosen, visual report values | R |
| Cases: word problem / formula / verbal (T/F/can't tell) / visualisation / probability, ~2 min each, sequential | R |
| Tolerance of ±0.011 on numeric answers | G |
| Study template set (largest share, growth, cost per unit, projection) | G (modelled on reported question types) |
| Suggested 23-min Study / 12-min Cases split | G |

## Sea Wolf
| Detail | Source |
|---|---|
| 3 sites, exactly 3 microbes each, one 30-min clock | R |
| 3 attributes rated 1–10 + 1 trait (default) | R (most reports) |
| 7 attributes / 5 traits (alt mode) | C (one provider) — `seaWolf.mode` |
| Site: target range per attribute, one desired + one undesired trait | R |
| Treatment value = average of the 3 microbes | R |
| 4-step loop: lock 2 → sort 10 one at a time → pool of 6 + 4 rounds (keep 1 of 3) → pick 3 | R |
| Effectiveness = 5 checks × 20% | R (widely reported practice model, unconfirmed) |
| Next-site preview shows only one characteristic (its desired trait) | R (player's understanding; reports vary) |
| Sorting "fit" = ≥2 of 3 attributes in range and no undesired trait | G |
| Sorting "next" = not a fit here but carries the next site's desired trait | G (follows from the one-trait preview) |
| Hard mode: 2-point ranges, more edge ranges, scarce desired trait, near-miss decoys, planted trio split across queue and offers, ≤2 perfect trios per site | G — `seaWolf.hard` |
| Routed microbes appear in that site's offer rounds | G |
| 60% of sites solvable to 100% | G |

## Sustainable Futures Lab
| Detail | Source |
|---|---|
| Classic: text-only, 2 intro screens, rank 4 priorities, ~12 decisions, outcome pages, branching, 20 min | R |
| Island: 4 researchers, 4 workstations, 3 days, day goals (researcher / workstation / balance) | R |
| Explore / Assign / Support / Reflect loop, overnight reset | R |
| Explore Requests 3 / 3 / 2 | G (practice default; reports vary) |
| Capacity 2 per workstation; 5 assignment reasons | R |
| Reason counts only if backed by an answer bought today | R (reported), scoring weight **G** |
| Reflect: 3-point scale + "I don't know" | R; whether it is scored is unknown — credit rule is **G** |
| All SFL scoring dimensions and weights | G |

## Ecosystem Building (legacy)
| Detail | Source |
|---|---|
| Phased out mid-2025 | R |
| 8 species from ~39, eating order / tie-split rules | R (public rule descriptions; logic ported, no species data copied) |

## Known unknowns
- Exact Sea Wolf attribute/trait counts and the real score formula.
- How much (if at all) process telemetry is weighted. The practice model uses 70% product / 30% process (`CONFIG.scoring`).
- Whether SFL Island Reflect ratings are scored directly.
- Whether the 95-min SFL Island format is a pilot or the new standard.
