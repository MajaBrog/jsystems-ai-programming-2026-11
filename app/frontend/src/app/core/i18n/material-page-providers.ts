import { Provider } from '@angular/core';
import { MatDatepickerIntl } from '@angular/material/datepicker';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { PolishDatepickerIntl } from './polish-datepicker-intl';

/**
 * Material defaults for the feature pages. Provided on the lazy-loaded pages, not in app.config,
 * so the datepicker/form-field entry points stay out of the initial bundle (500 kB budget).
 */
export const MATERIAL_PAGE_PROVIDERS: Provider[] = [
  { provide: MatDatepickerIntl, useClass: PolishDatepickerIntl },
  { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { appearance: 'outline' } },
];
