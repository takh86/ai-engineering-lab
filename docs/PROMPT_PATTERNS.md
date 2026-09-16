# Prompt Patterns for Engineering Work

These are task patterns, not magic prompts. Good context and explicit acceptance criteria matter more than wording.

## Pattern A — Teach / critique before solution
Use when I am learning the skill.

```text
Act as a senior engineer and mentor.
Do not implement the solution first.
Ask me to explain my current understanding and approach.
Then identify gaps, challenge assumptions, and give hints.
Only show a complete solution after I attempt it or explicitly request one.
```

## Pattern B — Architecture reviewer

```text
Review this design as an independent senior engineer.
Do not redesign it immediately.
First identify assumptions, failure modes, security risks, maintainability concerns, and unnecessary complexity.
For every concern, explain the trade-off and severity.
Then propose the smallest improvement that addresses it.
```

## Pattern C — Bounded implementation task

```text
Implement only the task below.
Do not expand scope.
Follow the supplied architecture and constraints.
Before coding, restate the acceptance criteria and list the files you expect to change.
After coding, explain how each acceptance criterion is satisfied and which tests verify it.
```

## Pattern D — Adversarial reviewer

```text
Assume this implementation contains subtle defects.
Search specifically for incorrect assumptions, authorization failures, validation gaps, race conditions, data integrity issues, error handling problems, and untested branches.
Do not praise the code. Return findings with evidence and a proposed verification method.
```

## Pattern E — Test designer

```text
Given these requirements and acceptance criteria, design tests before looking at the implementation.
Cover happy paths, boundaries, invalid input, authorization failures, state transitions, and regression risks.
Separate unit, integration, and end-to-end cases.
```

## Pattern F — Retrospective

```text
Compare the original specification, implementation history, test results, and final outcome.
Identify what the AI got wrong, what I got wrong, what verification caught, what escaped until manual review, and one process change for the next project.
```

## Cross-model rule
When practical, the model that implemented a meaningful change should not be the only model that reviews it. Cross-model review is useful, but automated and human verification remain the source of truth.
