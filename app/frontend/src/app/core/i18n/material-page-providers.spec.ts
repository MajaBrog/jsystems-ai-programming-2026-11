import { TestBed } from '@angular/core/testing';
import { MatDatepickerIntl } from '@angular/material/datepicker';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { MATERIAL_PAGE_PROVIDERS } from './material-page-providers';

describe('MATERIAL_PAGE_PROVIDERS', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: MATERIAL_PAGE_PROVIDERS }));

  it('datepicker accessibility labels are Polish (UI must be Polish, PRD §9)', () => {
    const intl = TestBed.inject(MatDatepickerIntl);
    expect(intl.openCalendarLabel).toBe('Otwórz kalendarz');
    expect(intl.closeCalendarLabel).toBe('Zamknij kalendarz');
    expect(intl.prevMonthLabel).toBe('Poprzedni miesiąc');
    expect(intl.nextMonthLabel).toBe('Następny miesiąc');
  });

  it('form fields default to the outlined appearance (brand inputs: white, ink outline)', () => {
    expect(TestBed.inject(MAT_FORM_FIELD_DEFAULT_OPTIONS).appearance).toBe('outline');
  });
});
