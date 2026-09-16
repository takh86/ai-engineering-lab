# Quality Gates

Use only the gates relevant to project risk, but never declare completion based on visual inspection alone.

## Required baseline
- [ ] Requirements are understandable
- [ ] Acceptance criteria exist
- [ ] Type check passes
- [ ] Lint passes
- [ ] Unit tests pass
- [ ] Critical error paths are tested
- [ ] No secrets committed
- [ ] README explains setup and design
- [ ] Human review completed

## Backend / API projects
- [ ] Integration tests pass
- [ ] Input validation exists
- [ ] Authorization paths are tested
- [ ] Database constraints align with business rules
- [ ] Error responses are intentional and documented

## Production-oriented projects
- [ ] CI executes verification automatically
- [ ] Configuration is environment-based
- [ ] Health/readiness behavior exists where appropriate
- [ ] Logging is useful without exposing secrets
- [ ] Rate limiting / abuse cases considered
- [ ] Dependency/security scan reviewed

## AI-powered products
- [ ] Evaluation dataset exists
- [ ] Expected outputs are defined
- [ ] Known failure modes are documented
- [ ] Prompt/model version is tracked
- [ ] Non-AI validation is used where possible
