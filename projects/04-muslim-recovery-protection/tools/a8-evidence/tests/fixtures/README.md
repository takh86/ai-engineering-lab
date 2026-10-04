# Synthetic tool fixtures only

Every file here is invented test input for the collector. These are **not physical-device
evidence, V0-V13 evidence, architecture verification or verification PASS/FAIL evidence**.
The addresses use documentation ranges and the identities are synthetic. The collector has
no fixture or simulation mode. Tests inject fixture responses into its module in memory;
they never invoke an installed adb or connect to a phone. Empty and malformed cases are
also constructed in the test script.
