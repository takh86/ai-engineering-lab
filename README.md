# AI Engineering Lab

**Human-led. AI-assisted. Test-verified.**

AI Engineering Lab is a public portfolio of small, independent software projects built to demonstrate two complementary capabilities:

1. **Software engineering fundamentals** — understanding, designing, implementing, debugging, testing, and explaining software without blindly relying on AI.
2. **AI-directed software engineering** — using AI systems as engineering leverage while keeping human ownership of requirements, architecture, risk, verification, and final approval.

> This lab is intentionally independent from my internship, university thesis, and other long-running projects.

## What this lab is not

This is not a collection of one-shot generated apps or unreviewed "vibe coding" experiments. AI-generated output is treated as **untrusted until verified** through engineering checks.

## Engineering model

```text
Problem
  ↓
Human understanding
  ↓
Requirements + acceptance criteria
  ↓
Architecture / technical plan
  ↓
AI task assignment
  ↓
Implementation
  ↓
Automated verification
  ↓
Independent review
  ↓
Human approval
  ↓
Ship + measure + retrospective
```

## Roles

| Role | Responsibility |
|---|---|
| Human / Tech Lead | Problem framing, requirements, architecture ownership, trade-offs, final approval |
| ChatGPT | Learning, architecture critique, research, planning, independent review |
| Claude | Implementation, alternative solution generation, code review, debugging support |
| Tests / CI | Objective verification |

The exact AI assignment may change per project so that no single model becomes a source of truth.

## Quality gates

A project is not considered complete because it "runs on my machine". Depending on scope, it should pass:

- Type checking
- Linting
- Unit tests
- Integration tests
- Acceptance criteria
- Security review
- Error-path testing
- Documentation review
- CI checks
- Manual final review

See [`docs/QUALITY_GATES.md`](docs/QUALITY_GATES.md).

## Lab roadmap

| # | Project | Main learning goal | Human focus | AI focus |
|---|---|---|---|---|
| 01 | Task Management API | Spec-driven backend development | Requirements, API design, review | Implementation + tests |
| 02 | Job Application Tracker | Production engineering | Architecture, data model, operations | Feature delivery + review |
| 03 | Requirements Reviewer | AI product engineering | Product logic, eval criteria | AI integration + experiments |

See [`PROJECTS.md`](PROJECTS.md).

## Repository standard

Every project in the lab should expose not only the code, but the engineering process:

```text
README.md
src/
tests/
docs/
  problem.md
  requirements.md
  architecture.md
  ai-workflow.md
  decisions.md
  testing-strategy.md
  postmortem.md
.github/workflows/
```

## AI transparency

Each project records:

- what I decided myself,
- what AI was asked to do,
- how AI output was verified,
- which mistakes were found,
- what I changed after review,
- what I learned personally.

The goal is not to prove that AI can write code. The goal is to prove that I can **direct, verify, and take responsibility for AI-assisted software engineering**.
