package com.muslimrecovery.protection.core.design

import android.graphics.Paint
import androidx.core.content.res.ResourcesCompat
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.muslimrecovery.protection.R
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Both bundled font resources (Cairo Bold, Tajawal Regular) load as a Typeface on the managed devices (API 30 and 34;
 * API 24 is not exercised by CI, a static TrueType font has no API-gated feature) and the OFL notices are packaged as
 * assets. Glyph COVERAGE of each file is proven by the JVM FontCoverageTest (it parses the file's own cmap), because
 * Paint.hasGlyph also sees the platform fallback fonts and so cannot prove it.
 */
@RunWith(AndroidJUnit4::class)
class FontFamilyTest {
    private val context get() = InstrumentationRegistry.getInstrumentation().targetContext

    private fun assertRenders(resId: Int, name: String) {
        val typeface = ResourcesCompat.getFont(context, resId)
        assertNotNull("$name must load", typeface)
        val paint = Paint().apply { this.typeface = typeface }
        for (text in listOf("a", "Z", "7", "ä", "ö", "ü", "ß", "ع", "ر", "ب", "ي", "٣")) {
            assertTrue("$name: measured width of $text must be positive", paint.measureText(text) > 0f)
        }
    }

    @Test
    fun cairoBoldLoadsAsATypeface() = assertRenders(R.font.cairo_bold, "Cairo Bold")

    @Test
    fun tajawalRegularLoadsAsATypeface() = assertRenders(R.font.tajawal_regular, "Tajawal Regular")

    @Test
    fun theOflNoticesArePackagedWithTheApplication() {
        for (name in listOf("OFL-Cairo.txt", "OFL-Tajawal.txt")) {
            val text = context.assets.open("licenses/$name").bufferedReader().use { it.readText() }
            assertTrue("$name must contain the license", text.contains("SIL OPEN FONT LICENSE Version 1.1"))
        }
    }
}
