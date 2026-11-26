import { TestBed } from '@angular/core/testing';
import { AssessmentCategory } from '../../core/models';
import { AssessmentBadge } from './assessment-badge';

describe('AssessmentBadge', () => {
  const cases: [AssessmentCategory, string, string][] = [
    ['ACCEPT', 'Przyjęte wstępnie', 'accept'],
    ['REJECT', 'Odrzucone wstępnie', 'reject'],
    ['NEEDS_REVIEW', 'Wymaga weryfikacji', 'needs-review'],
  ];

  it.each(cases)('%s shows Polish text, an icon and a category class', async (category, label, cls) => {
    const f = TestBed.createComponent(AssessmentBadge);
    f.componentRef.setInput('category', category);
    await f.whenStable();
    const el: HTMLElement = f.nativeElement;
    expect(el.textContent).toContain(label);
    expect(el.querySelector('.material-symbols-outlined, mat-icon')).toBeTruthy();
    expect(el.querySelector(`.badge.${cls}`)).toBeTruthy();
  });
});
