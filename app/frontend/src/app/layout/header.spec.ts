import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppHeader } from './header';

describe('AppHeader', () => {
  it('renders logo and new-case link', async () => {
    await TestBed.configureTestingModule({
      imports: [AppHeader],
      providers: [provideRouter([])],
    }).compileComponents();
    const f = TestBed.createComponent(AppHeader);
    await f.whenStable();
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('DevPowers');
    expect(el.textContent).toContain('Nowe zgłoszenie');
  });
});
