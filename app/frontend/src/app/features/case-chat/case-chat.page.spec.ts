import { TestBed } from '@angular/core/testing';
import { CaseChatPage } from './case-chat.page';

describe('CaseChatPage (placeholder)', () => {
  it('shows the case id', async () => {
    await TestBed.configureTestingModule({ imports: [CaseChatPage] }).compileComponents();
    const f = TestBed.createComponent(CaseChatPage);
    f.componentRef.setInput('id', 'x1');
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain('x1');
  });
});
