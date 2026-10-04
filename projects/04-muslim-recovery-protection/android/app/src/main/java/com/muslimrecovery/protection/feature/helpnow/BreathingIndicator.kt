package com.muslimrecovery.protection.feature.helpnow

import android.provider.Settings
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.muslimrecovery.protection.R
import com.muslimrecovery.protection.core.design.layout.TabsiraSpacing

private const val BREATH_PHASE_MILLIS = 4000
private const val SMALL_SCALE = 0.6f

/** True when the system animation scale is 0 (the standard "remove animations" signal). Never throws. */
@Composable
fun rememberReduceMotion(): Boolean {
    val context = LocalContext.current
    return remember(context) {
        try {
            Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
        } catch (e: Exception) {
            false
        }
    }
}

/**
 * A slow breathing guide: a circle that grows and shrinks over four seconds each way, always with a text cue, so
 * the meaning never rests on motion or color alone. With [reduceMotion] there is no animation at all, only a
 * static sentence. The circle is decorative and hidden from accessibility services.
 */
@Composable
fun BreathingIndicator(reduceMotion: Boolean, modifier: Modifier = Modifier) {
    if (reduceMotion) {
        Text(
            text = stringResource(R.string.helpnow_breathe_static),
            style = MaterialTheme.typography.bodyLarge,
            textAlign = TextAlign.Center,
            modifier = modifier.fillMaxWidth().testTag(HelpNowTags.BREATHING_STATIC),
        )
        return
    }
    var inhale by remember { mutableStateOf(true) }
    val scale = remember { Animatable(SMALL_SCALE) }
    LaunchedEffect(Unit) {
        while (true) {
            inhale = true
            scale.animateTo(1f, tween(BREATH_PHASE_MILLIS, easing = LinearEasing))
            inhale = false
            scale.animateTo(SMALL_SCALE, tween(BREATH_PHASE_MILLIS, easing = LinearEasing))
        }
    }
    Column(
        modifier = modifier.fillMaxWidth().testTag(HelpNowTags.BREATHING_ANIMATED),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(TabsiraSpacing.m),
    ) {
        Box(
            modifier = Modifier
                .size(120.dp)
                .clearAndSetSemantics { }
                .graphicsLayer {
                    scaleX = scale.value
                    scaleY = scale.value
                }
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.primary)
                .border(TabsiraSpacing.borderControl, MaterialTheme.colorScheme.onPrimary, CircleShape),
        )
        Text(
            text = stringResource(if (inhale) R.string.helpnow_breathe_in else R.string.helpnow_breathe_out),
            style = MaterialTheme.typography.bodyLarge,
            textAlign = TextAlign.Center,
        )
    }
}

/** Test hooks. */
internal object HelpNowTags {
    const val PHASE_HEADING = "helpnow_phase_heading"
    const val TIMER = "helpnow_timer"
    const val TIMER_FINISHED = "helpnow_timer_finished"
    const val BREATHING_STATIC = "helpnow_breathing_static"
    const val BREATHING_ANIMATED = "helpnow_breathing_animated"
}
