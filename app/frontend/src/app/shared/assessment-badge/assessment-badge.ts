import { Component, computed, input } from '@angular/core';
import { AssessmentCategory } from '../../core/models';

export const ASSESSMENT_LABELS: Record<AssessmentCategory, string> = {
  ACCEPT: 'Przyjęte wstępnie',
  REJECT: 'Odrzucone wstępnie',
  NEEDS_REVIEW: 'Wymaga weryfikacji',
};

const ICONS: Record<AssessmentCategory, string> = {
  ACCEPT: 'check_circle',
  REJECT: 'cancel',
  NEEDS_REVIEW: 'pending',
};

const CLASSES: Record<AssessmentCategory, string> = {
  ACCEPT: 'accept',
  REJECT: 'reject',
  NEEDS_REVIEW: 'needs-review',
};

/** Category as text + icon + colour (never colour only). */
@Component({
  selector: 'app-assessment-badge',
  styleUrl: './assessment-badge.scss',
  template: `<span class="badge" [class]="'badge ' + cls()"
    ><span class="material-symbols-outlined" aria-hidden="true">{{ icon() }}</span
    >{{ label() }}</span
  >`,
})
export class AssessmentBadge {
  readonly category = input.required<AssessmentCategory>();
  protected readonly label = computed(() => ASSESSMENT_LABELS[this.category()]);
  protected readonly icon = computed(() => ICONS[this.category()]);
  protected readonly cls = computed(() => CLASSES[this.category()]);
}
