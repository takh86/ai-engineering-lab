package com.muslimrecovery.protection.core.design

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.nio.ByteBuffer
import java.security.MessageDigest

/**
 * Proves the two bundled font files themselves (not the platform, which appends fallback fonts) are the files the provenance
 * document records, are static TrueType with the expected weight, and cover the glyphs the three languages need.
 */
class FontCoverageTest {
    private val cairo = File("src/main/res/font/cairo_bold.ttf")
    private val tajawal = File("src/main/res/font/tajawal_regular.ttf")
    private val assets = File("src/main/assets/licenses")
    private val doc = File("../../docs/android/font-sources-and-licenses.md")

    private fun sha256(file: File) =
        MessageDigest.getInstance("SHA-256").digest(file.readBytes()).joinToString("") { "%02x".format(it) }

    private fun recordedHash(name: String): String {
        assertTrue("provenance document must exist from the unit-test working directory", doc.isFile)
        val hash = Regex("- ${Regex.escape(name)} SHA-256: `([0-9a-f]{64})`").find(doc.readText())?.groupValues?.get(1)
        return checkNotNull(hash) { "no recorded SHA-256 for $name in the provenance document" }
    }

    private fun sfntTables(bytes: ByteArray): Map<String, Int> {
        val b = ByteBuffer.wrap(bytes)
        val tables = b.getShort(4).toInt() and 0xFFFF
        return (0 until tables).associate { i ->
            val rec = 12 + i * 16
            String(bytes, rec, 4, Charsets.US_ASCII) to b.getInt(rec + 8)
        }
    }

    private fun weightClass(bytes: ByteArray): Int {
        val os2 = checkNotNull(sfntTables(bytes)["OS/2"]) { "no OS/2 table" }
        return ByteBuffer.wrap(bytes).getShort(os2 + 4).toInt() and 0xFFFF
    }

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

    private fun covered(file: File): Set<Int> = cmapCoverage(file.readBytes())

    private val fonts get() = mapOf("cairo_bold.ttf" to (cairo to 700), "tajawal_regular.ttf" to (tajawal to 400))

    @Test
    fun bothFontsAreExactlyTheFilesTheProvenanceDocumentRecords() {
        for ((name, file) in fonts.mapValues { it.value.first }) {
            assertEquals("$name must match the recorded SHA-256 (a changed hash needs an explicit review)", recordedHash(name), sha256(file))
        }
        assertEquals(recordedHash("OFL-Cairo.txt"), sha256(File(assets, "OFL-Cairo.txt")))
        assertEquals(recordedHash("OFL-Tajawal.txt"), sha256(File(assets, "OFL-Tajawal.txt")))
    }

    @Test
    fun bothFontsAreStaticTrueTypeWithTheExpectedWeight() {
        val variationTables = listOf("fvar", "gvar", "avar", "STAT", "HVAR", "MVAR", "cvar")
        for ((name, spec) in fonts) {
            val (file, weight) = spec
            val bytes = file.readBytes()
            assertEquals("$name must be TrueType outlines (sfnt 0x00010000)", 0x00010000, ByteBuffer.wrap(bytes).getInt(0))
            val tables = sfntTables(bytes)
            assertTrue("$name needs glyf/loca", "glyf" in tables && "loca" in tables)
            assertTrue("$name must not be a CFF font", "CFF " !in tables && "CFF2" !in tables)
            assertEquals("$name must have no variation tables", emptyList<String>(), variationTables.filter { it in tables })
            assertEquals("$name OS/2 weight class", weight, weightClass(bytes))
        }
    }

    @Test
    fun theLicenseNoticesShipAsAssetsWithTheUpstreamCopyrightLines() {
        val cairoText = File(assets, "OFL-Cairo.txt").readText()
        val tajawalText = File(assets, "OFL-Tajawal.txt").readText()
        for (text in listOf(cairoText, tajawalText)) assertTrue(text.contains("SIL OPEN FONT LICENSE Version 1.1"))
        assertTrue(cairoText.contains("Copyright 2009 The Cairo Project Authors"))
        assertTrue(tajawalText.contains("Copyright 2018 Boutros International"))
    }

    @Test
    fun theFontsThemselvesCoverLatinGermanAndArabic() {
        val required = buildList {
            addAll('A'.code..'Z'.code); addAll('a'.code..'z'.code); addAll('0'.code..'9'.code)
            addAll("äöüßÄÖÜ".map { it.code })
            addAll(0x0627..0x063A); addAll(0x0641..0x064A)   // Arabic letters (U+063B-063F are unassigned for Arabic)
            addAll(0x064B..0x0652)                            // harakat
            addAll(0x0660..0x0669)                            // Arabic-Indic digits
            addAll(listOf(0x060C, 0x061F, 0x0640))
        }
        for ((name, spec) in fonts) {
            val set = covered(spec.first)
            assertTrue("$name: cmap parser must see a real font, saw ${set.size} code points", set.size > 200)
            val missing = required.filter { it !in set }.map { "U+%04X".format(it) }
            assertEquals("glyphs missing from the bundled $name", emptyList<String>(), missing)
        }
    }

    @Test
    fun theParserRejectsNonFontsAndDoesNotInventCoverage() {
        val failed = runCatching { cmapCoverage(ByteArray(64)) }.isFailure
        assertTrue("a non-font must not parse as an empty-but-valid font", failed)
        assertTrue("0x1F600 (emoji) is in neither font", fonts.values.all { 0x1F600 !in covered(it.first) })
    }
}
