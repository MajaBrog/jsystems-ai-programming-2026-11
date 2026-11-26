import { Injectable } from '@angular/core';
import { MatDatepickerIntl } from '@angular/material/datepicker';

/** Polish labels for the Material datepicker (screen-reader and tooltip texts). */
@Injectable()
export class PolishDatepickerIntl extends MatDatepickerIntl {
  override calendarLabel = 'Kalendarz';
  override openCalendarLabel = 'Otwórz kalendarz';
  override closeCalendarLabel = 'Zamknij kalendarz';
  override prevMonthLabel = 'Poprzedni miesiąc';
  override nextMonthLabel = 'Następny miesiąc';
  override prevYearLabel = 'Poprzedni rok';
  override nextYearLabel = 'Następny rok';
  override prevMultiYearLabel = 'Poprzednie 24 lata';
  override nextMultiYearLabel = 'Następne 24 lata';
  override switchToMonthViewLabel = 'Wybierz datę';
  override switchToMultiYearViewLabel = 'Wybierz miesiąc i rok';
  override startDateLabel = 'Data początkowa';
  override endDateLabel = 'Data końcowa';
}
