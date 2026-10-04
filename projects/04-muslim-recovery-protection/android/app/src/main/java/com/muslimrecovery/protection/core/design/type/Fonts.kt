package com.muslimrecovery.protection.core.design.type

import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import com.muslimrecovery.protection.R

/**
 * Body text: Tajawal Regular, a static TrueType asset with proven provenance
 * (docs/android/font-sources-and-licenses.md). It is bundled; no downloadable fonts.
 */
internal val BodyFontFamily: FontFamily = FontFamily(Font(R.font.tajawal_regular, FontWeight.Normal))

/**
 * Headings, titles and buttons. PLACEHOLDER: the approved face is Cairo Bold, but no static Android-compatible
 * Cairo Bold with authoritative provenance could be proven (E9 STOP rule, see the font provenance document), so
 * the system default family at Bold weight is used until the Owner picks one of the returned alternatives.
 * This is the single place to change; nothing else names a heading font.
 */
internal val HeadingFontFamily: FontFamily = FontFamily.Default
