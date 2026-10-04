package com.muslimrecovery.protection.core.design

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.nio.ByteBuffer
import java.security.MessageDigest

/**
 * Proves the bundled Tajawal file itself (not the platform, which appends fallback fonts) covers the glyphs the
 * three languages need, and that it is the file the provenance document records.
 */
class FontCoverageTest {
    private val font = File("src/main/res/font/tajawal_regular.ttf")

    /** Code points mapped by the font's cmap (format 4 or 12; platform 3 or 0). */
    private fun cmapCoverage(bytes: ByteArray): Set<Int> {
        val b = ByteBuffer.wrap(bytes)
        fun u16(o: Int) = b.getShort(o).toInt() and 0xFFFF
        fun u32(o: Int) = b.getInt(o).toLong() and 0xFFFFFFFFL
        val tables = u16(4)
        var cmap = -1
        for (i in 0 until tables) {
            val rec = 12 + i * 16
            if (String(bytes, rec, 4, Charsets.US_ASCII) == "cmap") cmap = u32(rec + 8).toInt()
        }
        require(cmap >= 0) { "no cmap table" }
        val covered = HashSet<Int>()
        for (i in 0 until u16(cmap + 2)) {
            val rec = cmap + 4 + i * 8
            val platform = u16(rec)
            if (platform != 3 && platform != 0) continue
            val sub = cmap + u32(rec + 4).toInt()
            when (u16(sub)) {
                4 -> {
                    val segCount = u16(sub + 6) / 2
                    val endCodes = sub + 14
                    val startCodes = endCodes + segCount * 2 + 2
                    val deltas = startCodes + segCount * 2
                    val rangeOffsets = deltas + segCount * 2
                    for (s in 0 until segCount) {
                        val end = u16(endCodes + s * 2)
                        val start = u16(startCodes + s * 2)
                        val delta = u16(deltas + s * 2)
                        val rangeOffset = u16(rangeOffsets + s * 2)
                        for (c in start..end) {
                            if (c == 0xFFFF) continue
                            val glyph = if (rangeOffset == 0) {
                                (c + delta) and 0xFFFF
                            } else {
                                val at = rangeOffsets + s * 2 + rangeOffset + (c - start) * 2
                                val g = u16(at)
                                if (g == 0) 0 else (g + delta) and 0xFFFF
                            }
                            if (glyph != 0) covered += c
                        }
                    }
                }
                12 -> {
                    for (g in 0 until u32(sub + 12).toInt()) {
                        val group = sub + 16 + g * 12
                        for (c in u32(group).toInt()..u32(group + 4).toInt()) covered += c
                    }
                }
            }
        }
        return covered
    }

    private fun covered(): Set<Int> = cmapCoverage(font.readBytes())

    @Test
    fun theFontIsTheFileTheProvenanceDocumentRecords() {
        val doc = File("../../docs/android/font-sources-and-licenses.md")
        assertTrue("provenance document must exist from the unit-test working directory", doc.isFile)
        val recorded = Regex("SHA-256 \\(font\\)[^`]*`([0-9a-f]{64})`").find(doc.readText())?.groupValues?.get(1)
        val actual = MessageDigest.getInstance("SHA-256").digest(font.readBytes()).joinToString("") { "%02x".format(it) }
        assertEquals("bundled font must match the recorded SHA-256", recorded, actual)
        assertTrue(File("../../docs/android/licenses/OFL-Tajawal.txt").readText().contains("SIL Open Font License"))
    }

    @Test
    fun theFontItselfCoversLatinGermanAndArabic() {
        val set = covered()
        assertTrue("cmap parser must see a real font, saw ${set.size} code points", set.size > 200)
        val required = buildList {
            addAll('A'.code..'Z'.code); addAll('a'.code..'z'.code); addAll('0'.code..'9'.code)
            addAll("äöüßÄÖÜ".map { it.code })
            addAll(0x0627..0x063A); addAll(0x0641..0x064A)   // Arabic letters (U+063B-063F are unassigned for Arabic)
            addAll(0x064B..0x0652)            // harakat
            addAll(0x0660..0x0669)            // Arabic-Indic digits
            addAll(listOf(0x060C, 0x061F, 0x0640))
        }
        val missing = required.filter { it !in set }.map { "U+%04X".format(it) }
        assertEquals("glyphs missing from the bundled file", emptyList<String>(), missing)
    }

    @Test
    fun theParserRejectsNonFontsAndDoesNotInventCoverage() {
        val failed = runCatching { cmapCoverage(ByteArray(64)) }.isFailure
        assertTrue("a non-font must not parse as an empty-but-valid font", failed)
        assertTrue("0x1F600 (emoji) is not in Tajawal", 0x1F600 !in covered())
    }
}
