package com.muslimrecovery.protection.feature.plan

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import com.muslimrecovery.protection.R
import com.muslimrecovery.protection.core.design.components.PrimaryButton
import com.muslimrecovery.protection.core.design.components.SecondaryButton
import com.muslimrecovery.protection.core.design.components.SectionCard
import com.muslimrecovery.protection.core.design.components.TabsiraScreen
import com.muslimrecovery.protection.core.design.components.TabsiraTextField
import com.muslimrecovery.protection.core.design.components.TextAction
import com.muslimrecovery.protection.core.design.layout.TabsiraSpacing
import com.muslimrecovery.protection.core.design.theme.TabsiraDesign

/** Test hooks (no content in tags). */
object PlanTags {
    const val SCREEN = "plan_screen"
    const val LOCKED = "plan_locked"
    const val PRIMARY_FIELD = "plan_field_primary"
    const val SECONDARY_FIELD = "plan_field_secondary"
    const val SAVE = "plan_save"
    const val CANCEL = "plan_cancel"
    const val CONFIRM_DELETE = "plan_confirm_delete"
    const val KEEP = "plan_keep"
    const val SAVE_AS_NEW = "plan_save_as_new"
    fun add(section: PlanSection) = "plan_add_${section.name}"
    fun edit(section: PlanSection, id: Long) = "plan_edit_${section.name}_$id"
    fun delete(section: PlanSection, id: Long) = "plan_delete_${section.name}_$id"
    fun empty(section: PlanSection) = "plan_empty_${section.name}"
}

/**
 * Route composable for My Plan. The Integration Agent supplies the [PlanViewModel] (see [PlanViewModel.factory]) and
 * wires [onBack]; F5 does not touch navigation. Nothing here reads or writes persistent storage.
 */
@Composable
fun PlanRoute(viewModel: PlanViewModel, onBack: () -> Unit) {
    val state by viewModel.state.collectAsState()
    PlanScreen(
        state = state,
        onEvent = viewModel::onEvent,
        onSubmit = viewModel::submit,
        onBack = onBack,
    )
}

/** Stateless screen: renders [state] and reports intent through [onEvent] (UI only) and [onSubmit] (store writes). */
@Composable
fun PlanScreen(
    state: PlanState,
    onEvent: (PlanEvent) -> Unit,
    onSubmit: (PlanEvent) -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    TabsiraScreen(modifier = modifier.testTag(PlanTags.SCREEN), scrollable = true) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(vertical = TabsiraSpacing.l),
            verticalArrangement = Arrangement.spacedBy(TabsiraSpacing.l),
        ) {
            TextAction(text = stringResource(R.string.common_back), onClick = onBack)
            Text(
                text = stringResource(R.string.plan_title),
                style = MaterialTheme.typography.headlineMedium,
                modifier = Modifier.semantics { heading() },
            )
            when (state.access) {
                PlanAccessKind.LOADING -> Text(stringResource(R.string.plan_loading), style = MaterialTheme.typography.bodyLarge)
                PlanAccessKind.LOCKED, PlanAccessKind.UNAVAILABLE -> LockedCard()
                PlanAccessKind.OPEN -> {
                    Text(
                        text = stringResource(R.string.plan_intro),
                        style = MaterialTheme.typography.bodyLarge,
                        color = TabsiraDesign.colors.textSecondary,
                    )
                    for (section in PlanSection.values()) {
                        SectionBlock(section, state, onEvent, onSubmit)
                    }
                }
            }
        }
    }
}

@Composable
private fun LockedCard() {
    SectionCard(modifier = Modifier.fillMaxWidth().testTag(PlanTags.LOCKED)) {
        Text(
            text = stringResource(R.string.plan_locked_title),
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.semantics { heading() },
        )
        Text(
            text = stringResource(R.string.plan_locked_body),
            style = MaterialTheme.typography.bodyLarge,
            modifier = Modifier.padding(top = TabsiraSpacing.s),
        )
    }
}

private fun titleRes(section: PlanSection) = when (section) {
    PlanSection.REASONS -> R.string.plan_section_reasons_title
    PlanSection.STEPS -> R.string.plan_section_steps_title
    PlanSection.IF_THEN -> R.string.plan_section_ifthen_title
}

private fun hintRes(section: PlanSection) = when (section) {
    PlanSection.REASONS -> R.string.plan_section_reasons_hint
    PlanSection.STEPS -> R.string.plan_section_steps_hint
    PlanSection.IF_THEN -> R.string.plan_section_ifthen_hint
}

private fun emptyRes(section: PlanSection) = when (section) {
    PlanSection.REASONS -> R.string.plan_empty_reasons
    PlanSection.STEPS -> R.string.plan_empty_steps
    PlanSection.IF_THEN -> R.string.plan_empty_ifthen
}

private fun addRes(section: PlanSection) = when (section) {
    PlanSection.REASONS -> R.string.plan_add_reason
    PlanSection.STEPS -> R.string.plan_add_step
    PlanSection.IF_THEN -> R.string.plan_add_ifthen
}

private fun primaryLabelRes(section: PlanSection) = when (section) {
    PlanSection.REASONS -> R.string.plan_field_reason
    PlanSection.STEPS -> R.string.plan_field_step
    PlanSection.IF_THEN -> R.string.plan_field_situation
}

@Composable
private fun SectionBlock(
    section: PlanSection,
    state: PlanState,
    onEvent: (PlanEvent) -> Unit,
    onSubmit: (PlanEvent) -> Unit,
) {
    val rows = state.snapshot.rows(section)
    val editor = state.editor?.takeIf { it.section == section }
    val atLimit = rows.size >= PlanLimits.MAX_ITEMS
    SectionCard(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = stringResource(titleRes(section)),
            style = MaterialTheme.typography.titleLarge,
            modifier = Modifier.semantics { heading() },
        )
        Text(
            text = stringResource(hintRes(section)),
            style = MaterialTheme.typography.bodyMedium,
            color = TabsiraDesign.colors.textSecondary,
            modifier = Modifier.padding(top = TabsiraSpacing.xs),
        )
        Column(
            modifier = Modifier.fillMaxWidth().padding(top = TabsiraSpacing.m),
            verticalArrangement = Arrangement.spacedBy(TabsiraSpacing.m),
        ) {
            if (rows.isEmpty() && editor == null) {
                Text(
                    text = stringResource(emptyRes(section)),
                    style = MaterialTheme.typography.bodyLarge,
                    modifier = Modifier.testTag(PlanTags.empty(section)),
                )
            }
            for (row in rows) {
                if (editor != null && editor.itemId == row.id) {
                    EditorBlock(editor, onEvent, onSubmit)
                } else {
                    ItemRow(section, row, state.pendingDelete, onEvent, onSubmit)
                }
            }
            if (editor != null && rows.none { it.id == editor.itemId }) EditorBlock(editor, onEvent, onSubmit)
            if (atLimit || state.limitNotice == section) {
                Text(
                    text = stringResource(R.string.plan_limit_reached, PlanLimits.MAX_ITEMS),
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
            SecondaryButton(
                text = stringResource(addRes(section)),
                onClick = { onEvent(PlanEvent.AddRequested(section)) },
                enabled = !atLimit && editor == null,
                modifier = Modifier.fillMaxWidth().testTag(PlanTags.add(section)),
            )
        }
    }
}

@Composable
private fun ItemRow(
    section: PlanSection,
    row: PlanRow,
    pending: PendingDelete?,
    onEvent: (PlanEvent) -> Unit,
    onSubmit: (PlanEvent) -> Unit,
) {
    val confirming = pending != null && pending.section == section && pending.id == row.id
    Column(verticalArrangement = Arrangement.spacedBy(TabsiraSpacing.xs), modifier = Modifier.fillMaxWidth()) {
        if (section == PlanSection.IF_THEN) {
            Text(stringResource(R.string.plan_if_label, row.primary), style = MaterialTheme.typography.bodyLarge)
            Text(stringResource(R.string.plan_then_label, row.secondary), style = MaterialTheme.typography.bodyLarge)
        } else {
            Text(row.primary, style = MaterialTheme.typography.bodyLarge)
        }
        if (confirming && pending != null) {
            Text(stringResource(R.string.plan_delete_confirm), style = MaterialTheme.typography.bodyMedium)
            if (pending.failed) Text(stringResource(R.string.plan_delete_failed), style = MaterialTheme.typography.bodyMedium)
            PrimaryButton(
                text = stringResource(R.string.plan_delete_confirm_action),
                onClick = { onSubmit(PlanEvent.DeleteConfirmed) },
                enabled = !pending.inFlight,
                modifier = Modifier.fillMaxWidth().testTag(PlanTags.CONFIRM_DELETE),
            )
            SecondaryButton(
                text = stringResource(R.string.plan_keep),
                onClick = { onEvent(PlanEvent.DeleteKept) },
                enabled = !pending.inFlight,
                modifier = Modifier.fillMaxWidth().testTag(PlanTags.KEEP),
            )
        } else {
            val preview = row.primary.take(PREVIEW_LENGTH)
            val editDescription = stringResource(R.string.plan_edit_item_description, preview)
            val deleteDescription = stringResource(R.string.plan_delete_item_description, preview)
            val edit = { onEvent(PlanEvent.EditRequested(section, row.id)) }
            val delete = { onEvent(PlanEvent.DeleteAsked(section, row.id)) }
            Column {
                TextAction(
                    text = stringResource(R.string.plan_edit),
                    onClick = edit,
                    modifier = Modifier
                        .testTag(PlanTags.edit(section, row.id))
                        .clearAndSetSemantics {
                            contentDescription = editDescription
                            role = Role.Button
                            onClick { edit(); true }
                        },
                )
                TextAction(
                    text = stringResource(R.string.plan_delete),
                    onClick = delete,
                    modifier = Modifier
                        .testTag(PlanTags.delete(section, row.id))
                        .clearAndSetSemantics {
                            contentDescription = deleteDescription
                            role = Role.Button
                            onClick { delete(); true }
                        },
                )
            }
        }
    }
}

private const val PREVIEW_LENGTH = 40

@Composable
private fun fieldErrorText(error: FieldError?, max: Int): String? = when (error) {
    null -> null
    FieldError.EMPTY -> stringResource(R.string.plan_error_empty)
    FieldError.TOO_LONG -> stringResource(R.string.plan_error_too_long, max)
    FieldError.INVALID_CHARACTERS -> stringResource(R.string.plan_error_invalid_characters)
}

@Composable
private fun EditorBlock(editor: EditorState, onEvent: (PlanEvent) -> Unit, onSubmit: (PlanEvent) -> Unit) {
    val section = editor.section
    val busy = editor.saving
    Column(verticalArrangement = Arrangement.spacedBy(TabsiraSpacing.s), modifier = Modifier.fillMaxWidth()) {
        TabsiraTextField(
            value = editor.primary,
            onValueChange = { onEvent(PlanEvent.PrimaryChanged(it)) },
            label = stringResource(primaryLabelRes(section)),
            enabled = !busy,
            errorText = fieldErrorText(editor.primaryError, PlanLimits.maxPrimary(section)),
            modifier = Modifier.fillMaxWidth().testTag(PlanTags.PRIMARY_FIELD),
        )
        Text(
            text = stringResource(
                R.string.plan_count,
                editor.primary.trim().let { it.codePointCount(0, it.length) },
                PlanLimits.maxPrimary(section),
            ),
            style = MaterialTheme.typography.bodySmall,
        )
        if (PlanLimits.hasSecondary(section)) {
            TabsiraTextField(
                value = editor.secondary,
                onValueChange = { onEvent(PlanEvent.SecondaryChanged(it)) },
                label = stringResource(R.string.plan_field_action),
                enabled = !busy,
                errorText = fieldErrorText(editor.secondaryError, PlanLimits.maxSecondary(section)),
                modifier = Modifier.fillMaxWidth().testTag(PlanTags.SECONDARY_FIELD),
            )
            Text(
                text = stringResource(
                    R.string.plan_count,
                    editor.secondary.trim().let { it.codePointCount(0, it.length) },
                    PlanLimits.maxSecondary(section),
                ),
                style = MaterialTheme.typography.bodySmall,
            )
        }
        if (editor.duplicate) Text(stringResource(R.string.plan_duplicate_note), style = MaterialTheme.typography.bodyMedium)
        if (editor.writeFailed) Text(stringResource(R.string.plan_save_failed), style = MaterialTheme.typography.bodyMedium)
        if (editor.itemGone) {
            Text(stringResource(R.string.plan_item_gone), style = MaterialTheme.typography.bodyMedium)
            PrimaryButton(
                text = stringResource(R.string.plan_save_as_new),
                onClick = { onSubmit(PlanEvent.SaveAsNewRequested) },
                enabled = !busy,
                modifier = Modifier.fillMaxWidth().testTag(PlanTags.SAVE_AS_NEW),
            )
        } else {
            PrimaryButton(
                text = stringResource(
                    when {
                        busy -> R.string.plan_saving
                        editor.writeFailed -> R.string.plan_retry
                        else -> R.string.plan_save
                    },
                ),
                onClick = { onSubmit(PlanEvent.SaveRequested) },
                enabled = !busy,
                modifier = Modifier.fillMaxWidth().testTag(PlanTags.SAVE),
            )
        }
        SecondaryButton(
            text = stringResource(R.string.common_cancel),
            onClick = { onEvent(PlanEvent.EditorCancelled) },
            enabled = !busy,
            modifier = Modifier.fillMaxWidth().testTag(PlanTags.CANCEL),
        )
    }
}
