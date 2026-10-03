# Integration of frozen 1.0.1 and final features

Local candidate only; no remote merge or store release.

Imported owner-supplied bundle verified against base 1d845d0. Its frozen head efc735777bd9dd096ce69da0717438f72fa99023 is preserved. A separate review/integration-101 worktree merges it with feature head1817d0a; 21 conflicting files were reconciled by core/UI/documentation reviewers and independently reviewed.

189/189 unit/static checks pass, including all28 unchanged 1.0.1 regressions. Controller regression scenarios and worker-capability harness pass using simulated browser APIs. Retained the bounded epoch, phrase-edge/parameter, late-writer, legacy lock migration, self-test, import/focus and locale fixes. New tests now distinguish persistent self-test from scheduled user rules.

Red Team found an undeclared focus variable in merged onboarding; declaration restored. Runtime packaged UI smoke passed26 states (13 light/13 dark), no page errors, including onboarding next/back. This uses headless shell with simulated extension APIs, not installed DNR. Historical installed-browser results from either parent do not certify this candidate. The old full E2E suite contains obsolete UI/core-disable/version assumptions and remains unrun, not passed. Native new-feature E2E startup is blocked by environment socket()/ptrace permissions before extension load; NOT_RUN.

Remaining release gates: test this exact Chrome ZIP on owner device; decide retained opt-in prayer/store single-purpose scope and approve accurate privacy disclosure. No actual idle termination, OS prayer delivery, mature real-time exit, Firefox runtime or signed-store upgrade claim.

Package digests: test-evidence/integration-101.json. Prior FOLLOWUP-REVIEW and second-followup files are historical; their missing-bundle gate is now superseded by this integration.
