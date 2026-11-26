import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE } from '@angular/material/core';
import { DateFnsAdapter } from '@angular/material-date-fns-adapter';
import { MarkdownService } from 'ngx-markdown';
import { pl } from 'date-fns/locale';
import { appConfig } from './app.config';

describe('appConfig', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: appConfig.providers }));

  it('provides Polish LOCALE_ID', () => {
    expect(TestBed.inject(LOCALE_ID)).toBe('pl');
  });

  it('provides date-fns adapter with pl locale', () => {
    expect(TestBed.inject(DateAdapter)).toBeInstanceOf(DateFnsAdapter);
    expect(TestBed.inject(MAT_DATE_LOCALE)).toBe(pl);
  });

  it('uses dd.MM.yyyy date formats', () => {
    const f = TestBed.inject(MAT_DATE_FORMATS);
    expect(f.parse.dateInput).toBe('dd.MM.yyyy');
    expect(f.display.dateInput).toBe('dd.MM.yyyy');
  });

  it('provides ngx-markdown with sanitization', async () => {
    const md = TestBed.inject(MarkdownService);
    const html = await md.parse('**b** <script>alert(1)</script>');
    expect(html).toContain('<strong>b</strong>');
    expect(html).not.toContain('<script');
  });
});
