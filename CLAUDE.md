# AI Engineering Lab

Human-led. AI-assisted. Test-verified.

The human is Tech Lead / Product Owner / final authority.
AI output is untrusted until verified.

Before coding:

- read the current task
- read the project's CLAUDE.md and relevant docs
- check git status, branch, and recent commits
- never work directly on main
- stop if scope, architecture, security, privacy, or repo state is unclear

Workflow:
requirements → approved design → branch → implementation → tests → review → PR → human approval

Rules:

- modify only task-relevant files
- do not implement future milestones
- no unrelated refactors
- no force push/destructive Git operations without approval
- do not claim success without running relevant checks
- major architecture/security/privacy/dependency decisions require human approval
- use sub-agents only for bounded research/review; one primary agent owns implementation
- optimize for verified output, not code/token volume

SecurePlan is separate. Never read, reuse, reference, or modify it while working on Lab projects.

At task end report:
branch, commits, changed files, verification, limitations, unresolved decisions, PR.
Then STOP.
