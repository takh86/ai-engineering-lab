package com.muslimrecovery.protection.domain.rules

/**
 * A hostname that has passed deterministic normalization and validation. Construct via
 * [NormalizedHostname.of] — the private constructor guarantees every instance in circulation
 * is already normalized and label-valid, so matching code never has to re-validate.
 *
 * Normalization applied:
 * - a single trailing DNS root dot is stripped (`blocked.example.` == `blocked.example`)
 * - the result is lowercased
 * - the result is split into labels on `.`
 *
 * Validation applied per label (DNS label rules, ASCII only — no IDN support in M1-03):
 * - 1–63 characters
 * - only `a`-`z`, `0`-`9`, `-`
 * - must not start or end with `-`
 *
 * Anything that fails validation (empty input, empty labels from consecutive/leading/trailing
 * dots, disallowed characters such as `/`, `:`, spaces, or a bare `.`) is rejected by [of]
 * rather than silently accepted.
 */
class NormalizedHostname private constructor(val labels: List<String>) {

    val value: String get() = labels.joinToString(".")

    override fun equals(other: Any?): Boolean = other is NormalizedHostname && labels == other.labels

    override fun hashCode(): Int = labels.hashCode()

    override fun toString(): String = value

    companion object {
        private val labelRegex = Regex("^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$")

        fun of(raw: String): NormalizedHostname? {
            val trimmed = raw.trim()
            if (trimmed.isEmpty()) return null

            val withoutRootDot = trimmed.removeSuffix(".")
            if (withoutRootDot.isEmpty()) return null

            val labels = withoutRootDot.lowercase().split(".")
            if (labels.any { !labelRegex.matches(it) }) return null

            return NormalizedHostname(labels)
        }
    }
}
