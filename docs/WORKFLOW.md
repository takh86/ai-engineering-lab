# AI-Directed Engineering Workflow

## 1. Problem
Write the user or business problem without proposing a solution prematurely.

## 2. Human understanding
Before asking AI to implement, I should be able to explain:
- who needs the feature,
- what outcome is expected,
- major constraints,
- important failure cases.

## 3. Requirements
Define functional requirements, business rules, non-functional constraints, and explicit out-of-scope items.

## 4. Acceptance criteria
Make success objectively testable before implementation.

## 5. Architecture / plan
For non-trivial work, decide components, data model, interfaces, risks, and trade-offs.

## 6. AI routing
Choose the tool based on the work:
- **HUMAN:** learning, judgment, ownership decisions
- **CHATGPT:** learning, critique, architecture, research, planning
- **CLAUDE:** implementation or independent alternative/review
- **CI/TESTS:** objective verification

AI roles can be swapped to avoid dependence on one model.

## 7. Implementation
Give AI a bounded task, relevant context, constraints, and acceptance criteria. Avoid "build the entire app" prompts.

## 8. Verification
Run automated checks and manually review critical logic. AI reviewing AI is not sufficient verification.

## 9. Independent review
Use another model or a separate review pass to search for defects, but treat findings as hypotheses until verified.

## 10. Human approval
I own the merge decision and should be able to explain the important code paths.

## 11. Retrospective
Record what failed, what AI got wrong, what verification caught, what I learned, and what should change in the next iteration.
