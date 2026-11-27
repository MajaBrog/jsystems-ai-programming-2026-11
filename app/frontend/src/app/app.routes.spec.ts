import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { appConfig } from './app.config';
import { CaseFormPage } from './features/case-form/case-form.page';
import { CaseChatPage } from './features/case-chat/case-chat.page';

describe('routes', () => {
  let harness: RouterTestingHarness;
  beforeEach(async () => {
    // Real app providers (locale, date adapter, markdown) — the lazy pages need them.
    TestBed.configureTestingModule({ providers: [...appConfig.providers, provideRouter(routes, withComponentInputBinding())] });
    harness = await RouterTestingHarness.create();
  });

  it("'' renders CaseFormPage", async () => {
    const cmp = await harness.navigateByUrl('/');
    expect(cmp).toBeInstanceOf(CaseFormPage);
  });

  it("'case/:id' renders CaseChatPage with id bound", async () => {
    const cmp = await harness.navigateByUrl('/case/abc-123', CaseChatPage);
    expect(cmp.id()).toBe('abc-123');
  });

  it('feature pages are lazy-loaded (keeps the initial bundle within budget)', () => {
    const lazy = routes.filter((r) => r.path === '' || r.path === 'case/:id');
    expect(lazy.every((r) => typeof r.loadComponent === 'function' && r.component === undefined)).toBe(true);
  });

  it('unknown path redirects to root', async () => {
    const cmp = await harness.navigateByUrl('/no/such/page');
    expect(TestBed.inject(Router).url).toBe('/');
    expect(cmp).toBeInstanceOf(CaseFormPage);
  });
});
