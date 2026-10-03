# Project Roadmap

## Lab rules

Each project must be independent, small enough to finish, technically explainable, and useful for demonstrating an engineering capability.

The lab uses two modes deliberately:

- **Learning Mode:** I attempt the core skill first; AI teaches, critiques, or reviews.
- **Production Mode:** I already understand the skill; I specify the task and use AI to accelerate implementation under tests and review.

---

## 01 — Task Management API

**Goal:** Establish the lab workflow with a backend project that is simple enough to verify deeply.

**Suggested stack:** TypeScript, NestJS, PostgreSQL, REST, JWT/RBAC, Jest, Docker, GitHub Actions.

**Human-owned work:**
- domain model
- API contract
- auth model
- acceptance criteria
- architecture review
- final code review

**AI-directed work:**
- boilerplate implementation
- DTO/test generation
- refactor proposals
- edge-case discovery
- independent code review

**Proof:** documented AI mistakes + passing verification gates.

---

## 02 — Job Application Tracker

**Goal:** Move from CRUD to production-oriented engineering.

**Potential capabilities:**
- users and authentication
- job applications and status history
- reminders / follow-up dates
- search and filtering
- rate limiting
- structured logging
- health checks
- Docker
- CI/CD
- basic observability

**Engineering emphasis:** reliability, deployment, operational thinking, and maintainability.

---

## 03 — Requirements Reviewer

**Goal:** Build an AI-powered software product rather than only software built *with* AI.

**Input:** a software requirement or small specification.

**Output examples:**
- ambiguity signals
- missing acceptance criteria
- unverifiable wording
- conflicting constraints
- suggested clarification questions

**Engineering emphasis:**
- prompt / model boundary
- deterministic validation where possible
- eval dataset
- false positives / false negatives
- versioned prompts
- measurable quality instead of "looks good"

This project must remain generic and independent from any private, internship, or thesis project.

---

## 04 — Muslim Recovery Protection

**Status:** the only project with code today (01–03 are plans). Live scope and milestones: [`projects/04-muslim-recovery-protection/README.md`](projects/04-muslim-recovery-protection/README.md) and its `docs/roadmap.md`.

**Parts:**
- `android/` — experimental DNS-only VPN app (Kotlin/Compose). It never reports "Protected".
- `chrome-extension/` — **Tabsira**, a local-only Chrome/Edge/Firefox extension that blocks sites and search phrases the user chooses. Built outside the M1–M6 plan at the Owner's direction (see `projects/04-muslim-recovery-protection/docs/tabsira-v1-contract.md`); its relationship to the milestones is not yet recorded in `docs/decisions.md`.
