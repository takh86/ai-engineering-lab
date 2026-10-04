package com.muslimrecovery.protection.core.design.type

/**
 * Type scale in `sp` (font-scale aware) with line heights, as plain numbers so tests need no Compose.
 * Arabic text needs generous leading: body styles must keep a line height of at least 1.5x the size.
 * Letter spacing is always zero (positive tracking breaks Arabic letter joining).
 */
internal object TypeScale {
    data class Step(val sizeSp: Int, val lineHeightSp: Int) {
        val ratio: Double get() = lineHeightSp.toDouble() / sizeSp
    }

    val headline = Step(28, 36)
    val title = Step(20, 28)
    val body = Step(17, 26)
    val bodySmall = Step(15, 23)
    val label = Step(16, 24)

    /** Styles that carry running text and must satisfy the Arabic leading rule. */
    val bodyStyles: List<Step> = listOf(body, bodySmall, label)
}
