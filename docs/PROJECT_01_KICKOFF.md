# Project 01 Kickoff — Task Management API

## Purpose
The first project exists to validate the **AI Engineering Lab process**, not to impress through product complexity.

## Product scope
A small backend API where authenticated users can create and manage their own tasks.

### V1 candidate capabilities
- register / login
- create task
- list own tasks
- update own task
- delete own task
- status: TODO / IN_PROGRESS / DONE

### Explicitly out of scope for V1
- frontend
- payments
- microservices
- queues
- AI features
- social features
- complex notifications

## Suggested stack
- TypeScript
- NestJS
- PostgreSQL
- REST
- class-validator
- JWT authentication
- Jest
- Docker
- GitHub Actions

## Human-first checkpoint
Before implementation, I should personally produce a first draft of:
1. entities / domain model,
2. API endpoints,
3. authorization rules,
4. acceptance criteria,
5. main error cases.

AI may critique this draft, but should not replace the first attempt.

## Suggested engineering sequence

### Milestone 0 — Spec
**Human → ChatGPT review**

Output:
- problem.md
- requirements.md
- acceptance criteria

### Milestone 1 — Architecture
**Human → ChatGPT/Claude critique**

Output:
- architecture.md
- data model
- API contract
- ADRs for important choices

### Milestone 2 — Project foundation
**AI executor → Human review**

Output:
- NestJS project foundation
- config / validation
- database connection
- test setup

### Milestone 3 — Auth
**AI executor → independent reviewer → tests → Human approval**

### Milestone 4 — Task lifecycle
Same loop, one bounded feature at a time.

### Milestone 5 — Production gates
- Docker
- CI
- security/dependency review
- error-path tests
- documentation

### Milestone 6 — Postmortem
Record:
- AI mistakes
- human mistakes
- verification effectiveness
- skill gained
- process changes

## Success condition
The project succeeds when I can explain and defend the system, objective verification passes, and the repository demonstrates a disciplined human-led AI workflow — not merely when all endpoints exist.
