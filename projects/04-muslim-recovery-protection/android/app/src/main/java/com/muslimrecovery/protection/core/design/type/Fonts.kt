package com.muslimrecovery.protection.core.design.type

import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import com.muslimrecovery.protection.R

/**
 * Body text: Tajawal Regular, an upstream static TrueType asset (docs/android/font-sources-and-licenses.md).
 * Bundled; no downloadable fonts.
 */
internal val BodyFontFamily: FontFamily = FontFamily(Font(R.font.tajawal_regular, FontWeight.Normal))

/**
 * Headings, titles and buttons: Cairo Bold (weight 700), a static instance generated from the pinned upstream
 * variable font (Owner decision D-F9-FONT; the generation, hashes and tool version are recorded in
 * docs/android/font-sources-and-licenses.md and verified by FontCoverageTest). Bundled; no runtime API-level branch.
 */
internal val HeadingFontFamily: FontFamily = FontFamily(Font(R.font.cairo_bold, FontWeight.Bold))
