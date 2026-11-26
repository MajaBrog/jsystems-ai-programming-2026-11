import { TestBed } from '@angular/core/testing';
import { provideMarkdown } from 'ngx-markdown';
import { AppMarkdown } from './markdown';

describe('AppMarkdown (AC-29)', () => {
  async function render(data: string): Promise<HTMLElement> {
    await TestBed.configureTestingModule({ imports: [AppMarkdown], providers: [provideMarkdown()] }).compileComponents();
    const f = TestBed.createComponent(AppMarkdown);
    f.componentRef.setInput('data', data);
    await f.whenStable();
    await new Promise((r) => setTimeout(r, 20));
    await f.whenStable();
    return f.nativeElement;
  }

  it('renders headings, bold and bullet lists without raw markup', async () => {
    const el = await render('### Uzasadnienie\n\n**Ważne**\n\n- jeden\n- dwa');
    expect(el.querySelector('h3')?.textContent).toBe('Uzasadnienie');
    expect(el.querySelector('strong')?.textContent).toBe('Ważne');
    expect(el.querySelectorAll('li').length).toBe(2);
    expect(el.textContent).not.toContain('###');
    expect(el.textContent).not.toContain('**');
  });

  it('strips scripts and event handlers', async () => {
    const el = await render('Tekst <script>window.__x = 1</script> <img src="x" onerror="window.__x = 2">');
    expect(el.querySelector('script')).toBeNull();
    expect(el.innerHTML).not.toContain('onerror');
  });
});
