# AI Engineering Scorecard

Use this after a milestone or project. Do not optimize for a high score; use it to expose weak engineering behavior.

| Dimension | Evidence to capture |
|---|---|
| Human understanding | Can I explain the critical design/code without AI? |
| Specification quality | Were scope and acceptance criteria explicit before coding? |
| Delegation quality | Were AI tasks bounded and contextualized? |
| Verification | Which automated/manual gates independently checked the result? |
| Defects caught | What mistakes were found and by which gate? |
| AI dependency risk | Where did I accept output I could not confidently explain? |
| Engineering leverage | What repetitive or low-value work was accelerated safely? |
| Skill gain | What can I now do or explain better myself? |
| Product output | What usable artifact was actually shipped? |
| Reusability | What template, test, component, or process can be reused? |

## Red flags
- "It worked" is the only verification.
- A model reviewed its own implementation and no independent check exists.
- I cannot explain an important code path.
- Tests were written only after implementation and merely mirror the code.
- Scope expanded because the model suggested extra features.
- The README claims quality that CI or tests do not prove.
- Raw prompt volume is presented as engineering skill.
