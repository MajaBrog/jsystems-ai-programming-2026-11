import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { CaseFormPage } from './features/case-form/case-form.page';
import { CaseChatPage } from './features/case-chat/case-chat.page';

describe('routes', () => {
  let harness: RouterTestingHarness;
  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes, withComponentInputBinding())] });
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

  it('unknown path redirects to root', async () => {
    const cmp = await harness.navigateByUrl('/no/such/page');
    expect(TestBed.inject(Router).url).toBe('/');
    expect(cmp).toBeInstanceOf(CaseFormPage);
  });
});
