import { registerLocaleData } from '@angular/common';
import localePl from '@angular/common/locales/pl';
import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { MAT_DATE_FORMATS, MAT_DATE_LOCALE } from '@angular/material/core';
import { provideDateFnsAdapter } from '@angular/material-date-fns-adapter';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { pl } from 'date-fns/locale';
import { provideMarkdown } from 'ngx-markdown';
import { routes } from './app.routes';

registerLocaleData(localePl);

export const PL_DATE_FORMATS = {
  parse: { dateInput: 'dd.MM.yyyy' },
  display: {
    dateInput: 'dd.MM.yyyy',
    monthYearLabel: 'LLLL yyyy',
    dateA11yLabel: 'PPP',
    monthYearA11yLabel: 'LLLL yyyy',
  },
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideMarkdown(),
    provideDateFnsAdapter(PL_DATE_FORMATS),
    { provide: MAT_DATE_LOCALE, useValue: pl },
    { provide: MAT_DATE_FORMATS, useValue: PL_DATE_FORMATS },
    { provide: LOCALE_ID, useValue: 'pl' },
  ],
};
