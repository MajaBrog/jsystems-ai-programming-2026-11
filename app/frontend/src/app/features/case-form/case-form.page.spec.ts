import { TestBed } from '@angular/core/testing';
import { CaseFormPage } from './case-form.page';

describe('CaseFormPage (placeholder)', () => {
  it('renders', async () => {
    await TestBed.configureTestingModule({ imports: [CaseFormPage] }).compileComponents();
    const f = TestBed.createComponent(CaseFormPage);
    await f.whenStable();
    expect(f.nativeElement.querySelector('h1')?.textContent).toContain('Nowe zgłoszenie');
  });
});
