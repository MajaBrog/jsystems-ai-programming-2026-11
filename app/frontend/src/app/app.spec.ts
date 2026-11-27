import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';

describe('App shell', () => {
  let el: HTMLElement;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    }).compileComponents();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    el = fixture.nativeElement;
  });

  it('renders header with accessible logo linking home', () => {
    const logo = el.querySelector('header [role="img"]');
    expect(logo?.getAttribute('aria-label')).toBe('DevPowers');
    expect(el.querySelector('header a[href="/"]')).toBeTruthy();
  });

  it('renders "Nowe zgłoszenie" link in header', () => {
    const link = Array.from(el.querySelectorAll('header a')).find((a) =>
      a.textContent?.includes('Nowe zgłoszenie'),
    );
    expect(link?.getAttribute('href')).toBe('/');
  });

  it('has a main landmark with a router outlet', () => {
    expect(el.querySelector('main router-outlet')).toBeTruthy();
  });
});
