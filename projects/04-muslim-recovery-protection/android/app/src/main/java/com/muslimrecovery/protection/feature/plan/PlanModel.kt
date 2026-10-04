package com.muslimrecovery.protection.feature.plan

/**
 * F5 My Plan domain model. Everything here is D1 (private) content: reasons, support steps and if-then plans.
 * It is pure Kotlin (no Android types). `toString` of every content-bearing type is redacted so an accidental
 * log or string template can never print the user's words.
 */
enum class PlanSection { REASONS, STEPS, IF_THEN }

class Reason(val id: Long, val text: String) {
    override fun equals(other: Any?) = other is Reason && other.id == id && other.text == text
    override fun hashCode() = 31 * id.hashCode() + text.hashCode()
    override fun toString() = "Reason(redacted)"
}

class SupportStep(val id: Long, val text: String) {
    override fun equals(other: Any?) = other is SupportStep && other.id == id && other.text == text
    override fun hashCode() = 31 * id.hashCode() + text.hashCode()
    override fun toString() = "SupportStep(redacted)"
}

/** Structured if-then plan: [ifSituation] is the situation, [thenAction] is what the user will do (OD-F5-5: two fields). */
class IfThenPlan(val id: Long, val ifSituation: String, val thenAction: String) {
    override fun equals(other: Any?) =
        other is IfThenPlan && other.id == id && other.ifSituation == ifSituation && other.thenAction == thenAction
    override fun hashCode() = 31 * (31 * id.hashCode() + ifSituation.hashCode()) + thenAction.hashCode()
    override fun toString() = "IfThenPlan(redacted)"
}

/** One displayable row, uniform across the three sections (`secondary` is empty except for if-then plans). */
class PlanRow(val id: Long, val primary: String, val secondary: String = "") {
    override fun equals(other: Any?) =
        other is PlanRow && other.id == id && other.primary == primary && other.secondary == secondary
    override fun hashCode() = 31 * (31 * id.hashCode() + primary.hashCode()) + secondary.hashCode()
    override fun toString() = "PlanRow(redacted)"
}

class PlanSnapshot(
    val reasons: List<Reason> = emptyList(),
    val steps: List<SupportStep> = emptyList(),
    val ifThenPlans: List<IfThenPlan> = emptyList(),
) {
    fun rows(section: PlanSection): List<PlanRow> = when (section) {
        PlanSection.REASONS -> reasons.map { PlanRow(it.id, it.text) }
        PlanSection.STEPS -> steps.map { PlanRow(it.id, it.text) }
        PlanSection.IF_THEN -> ifThenPlans.map { PlanRow(it.id, it.ifSituation, it.thenAction) }
    }

    fun count(section: PlanSection): Int = when (section) {
        PlanSection.REASONS -> reasons.size
        PlanSection.STEPS -> steps.size
        PlanSection.IF_THEN -> ifThenPlans.size
    }

    fun contains(section: PlanSection, id: Long): Boolean = rows(section).any { it.id == id }

    override fun equals(other: Any?) =
        other is PlanSnapshot && other.reasons == reasons && other.steps == steps && other.ifThenPlans == ifThenPlans
    override fun hashCode() = 31 * (31 * reasons.hashCode() + steps.hashCode()) + ifThenPlans.hashCode()
    override fun toString() = "PlanSnapshot(redacted)"
}

/** Contract limits (OD-F5-2, proposed values): 20 items per section; texts are measured in Unicode code points after trimming. */
object PlanLimits {
    const val MAX_ITEMS = 20
    const val MAX_REASON = 500
    const val MAX_STEP = 200
    const val MAX_SITUATION = 300
    const val MAX_ACTION = 300

    fun maxPrimary(section: PlanSection): Int = when (section) {
        PlanSection.REASONS -> MAX_REASON
        PlanSection.STEPS -> MAX_STEP
        PlanSection.IF_THEN -> MAX_SITUATION
    }

    /** Only if-then plans have a second field. */
    fun maxSecondary(section: PlanSection): Int = if (section == PlanSection.IF_THEN) MAX_ACTION else 0

    fun hasSecondary(section: PlanSection): Boolean = section == PlanSection.IF_THEN
}
