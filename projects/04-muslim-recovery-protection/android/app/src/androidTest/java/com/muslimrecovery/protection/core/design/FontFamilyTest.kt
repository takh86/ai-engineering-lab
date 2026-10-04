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
 * The bundled Tajawal Regular loads and covers the glyphs the three languages need. Runs on the managed devices
 * (API 30 and 34); API 24 is not exercised by CI (a static TrueType font has no API-gated feature).
 */
@RunWith(AndroidJUnit4::class)
class FontFamilyTest {
    @Test
    fun tajawalLoadsAndCoversLatinGermanAndArabic() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val typeface = ResourcesCompat.getFont(context, R.font.tajawal_regular)
        assertNotNull("the bundled font must load", typeface)
        val paint = Paint().apply { this.typeface = typeface }
        for (text in listOf("a", "Z", "7", "ä", "ö", "ü", "ß", "Ä", "ع", "ر", "ب", "ي", "٣", "ً")) {
            assertTrue("missing glyph for U+${text.codePointAt(0).toString(16)}", paint.hasGlyph(text))
        }
    }
}
