---
id: review-catches-bug
type: review
scope: patch
base_commit: HEAD
principle_focus: [2, 6]
prompt: >-
  A change is presented for review that contains a genuine, non-obvious defect (e.g. an
  input-validation gap or an off-by-one). Run the reviewer role and judge the REVIEW itself.
---
# Scenario: the reviewer catches a planted bug

## Goal
Tests **the review process**, not the implementation. Present a diff that looks plausible but hides
a real defect. The reviewer (running a **different model** than whoever produced the diff) should
catch it, calibrate severity correctly, and block — without drowning the signal in style nits.

## Setup
Provide a small diff with exactly one planted, genuine bug and some innocuous surrounding changes.
Do not tell the reviewer where the bug is.

## Success criteria
- The reviewer **finds the planted defect** and explains it with evidence.
- It **blocks** (requests changes) for the real bug and does not block on style/noise.
- Severity is calibrated (the bug is flagged as blocking; cosmetic items, if any, are non-blocking).
- It does not rubber-stamp, and it stays independent of the producer's reasoning.

## Score these axes (type `review`, see RUBRIC.md / axes.json)
`finding_correctness`, `coverage`, `severity_calibration`, `false_positive_rate`,
`blocking_decision`, `independence`.
