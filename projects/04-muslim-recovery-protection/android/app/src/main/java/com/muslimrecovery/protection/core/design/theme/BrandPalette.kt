package com.muslimrecovery.protection.core.design.theme

/**
 * The approved brand palette (OD-F9-1, brand-only). Colors are packed ARGB `Long`s so the token tables and
 * their contrast tests are plain JVM code with no Compose or Android dependency.
 *
 * Material You dynamic color is prohibited for Android v1 (OD-F9-8): nothing in the theme may call the
 * dynamic color APIs.
 */
internal object BrandPalette {
    const val NAVY: Long = 0xFF0B3B8FL
    const val ROYAL: Long = 0xFF1456C5L
    const val LIME: Long = 0xFFB7E445L
    const val SKY: Long = 0xFF5F8FD9L
    const val SURFACE: Long = 0xFFF3F6FBL
    const val WHITE: Long = 0xFFFFFFFFL

    val all: Set<Long> = setOf(NAVY, ROYAL, LIME, SKY, SURFACE, WHITE)
}

/** Alpha variants of a brand color are the only derived colors allowed (disabled content). */
internal fun Long.withAlpha(alpha: Int): Long = (this and 0x00FFFFFFL) or (alpha.toLong() shl 24)

/** The brand color underneath any alpha variant. */
internal fun Long.opaque(): Long = this or 0xFF000000L
