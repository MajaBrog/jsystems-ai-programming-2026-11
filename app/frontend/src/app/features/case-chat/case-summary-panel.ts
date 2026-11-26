import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { map } from 'rxjs';
import { AssessmentCategory, CaseView } from '../../core/models';
import { AssessmentBadge } from '../../shared/assessment-badge/assessment-badge';
import { CASE_TYPE_LABELS, DEVICE_CATEGORY_LABELS } from '../../shared/labels/labels';
import { formatDate } from './format-date';
import { PhotoDialog } from './photo-dialog';

/** Case summary above the messages (AC-24); collapsible under 768 px. */
@Component({
  selector: 'app-case-summary-panel',
  imports: [MatExpansionModule, AssessmentBadge],
  styleUrl: './case-summary-panel.scss',
  template: `
    <mat-expansion-panel class="summary" [expanded]="!narrow()" hideToggle="false">
      <mat-expansion-panel-header>
        <mat-panel-title>{{ typeLabel() }} · {{ data().modelName }}</mat-panel-title>
        <mat-panel-description><app-assessment-badge [category]="category()" /></mat-panel-description>
      </mat-expansion-panel-header>
      <div class="body">
        <button type="button" class="thumb" (click)="enlarge()" aria-label="Powiększ zdjęcie">
          <img [src]="data().photoUrl" alt="Zdjęcie urządzenia" />
        </button>
        <dl>
          <dt>Typ zgłoszenia</dt>
          <dd>{{ typeLabel() }}</dd>
          <dt>Kategoria</dt>
          <dd>{{ categoryLabel() }}</dd>
          <dt>Model</dt>
          <dd>{{ data().modelName }}</dd>
          <dt>Data zakupu</dt>
          <dd>{{ purchaseDate() }}</dd>
          <dt>Aktualna ocena</dt>
          <dd><app-assessment-badge [category]="category()" /></dd>
        </dl>
      </div>
    </mat-expansion-panel>
  `,
})
export class CaseSummaryPanel {
  readonly data = input.required<CaseView>();
  /** Live category (updated by assessment_changed before the view reloads). */
  readonly category = input.required<AssessmentCategory>();

  private readonly dialog = inject(MatDialog);
  protected readonly narrow = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 767.98px)')
      .pipe(map((s) => s.matches)),
    { initialValue: false },
  );
  protected readonly typeLabel = computed(() => CASE_TYPE_LABELS[this.data().caseType]);
  protected readonly categoryLabel = computed(() => DEVICE_CATEGORY_LABELS[this.data().deviceCategory]);
  protected readonly purchaseDate = computed(() => formatDate(this.data().purchaseDate));

  protected enlarge() {
    this.dialog.open(PhotoDialog, { data: this.data().photoUrl, maxWidth: '95vw' });
  }
}
