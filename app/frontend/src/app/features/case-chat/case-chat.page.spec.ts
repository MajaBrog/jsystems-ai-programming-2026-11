import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestKey } from '@angular/cdk/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatInputHarness } from '@angular/material/input/testing';
import { provideRouter } from '@angular/router';
import { provideMarkdown } from 'ngx-markdown';
import { CAPTURES, CaptureName, captureResponse } from '../../../testing/capture-response';
import { FETCH } from '../../core/case-api';
import { CaseChatPage } from './case-chat.page';

type Route = { get?: CaptureName; post?: CaptureName | (() => Response | Promise<Response>) };

// Harness-driven streaming tests with real waits run several seconds under load; default 5 s is too tight.
describe('CaseChatPage', { timeout: 30_000 }, () => {
  let routes: Route;
  let posts: string[];
  let fixture: ComponentFixture<CaseChatPage>;
  let loader: HarnessLoader;
  let el: HTMLElement;

  const fetchStub: typeof fetch = async (input, init) => {
    const method = init?.method ?? 'GET';
    if (method === 'POST') {
      posts.push(String(init?.body));
      const p = routes.post!;
      return typeof p === 'function' ? p() : captureResponse(p);
    }
    return captureResponse(routes.get!);
  };

  async function open(r: Route, id = 'dbd4a315-cd94-430b-a23b-5e7e9c2f4fff') {
    routes = r;
    posts = [];
    await TestBed.configureTestingModule({
      imports: [CaseChatPage],
      providers: [provideRouter([]), provideMarkdown(), { provide: FETCH, useValue: fetchStub }],
    }).compileComponents();
    fixture = TestBed.createComponent(CaseChatPage);
    fixture.componentRef.setInput('id', id);
    loader = TestbedHarnessEnvironment.loader(fixture);
    el = fixture.nativeElement;
    await settle();
  }

  async function settle(ms = 80) {
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, ms));
    await fixture.whenStable();
  }

  const input = () => loader.getHarness(MatInputHarness.with({ selector: 'textarea' }));
  const sendBtn = () => loader.getHarness(MatButtonHarness.with({ selector: '[data-testid=send]' }));
  const badge = () => el.querySelector('app-case-summary-panel app-assessment-badge')?.textContent ?? '';
  const bubbles = (role: string) => Array.from(el.querySelectorAll(`[data-role="${role}"]`)) as HTMLElement[];

  async function type(text: string) {
    await (await input()).setValue(text);
  }
  async function send() {
    await (await sendBtn()).click();
    await settle();
  }

  describe('loading the case (AC-24, AC-33, AC-34)', () => {
    beforeEach(() => open({ get: 'case-view-200' }));

    it('shows the summary panel with case data, photo thumbnail and current badge', () => {
      const text = el.querySelector('app-case-summary-panel')!.textContent!;
      expect(text).toContain('Reklamacja');
      expect(text).toContain('Testowy Laptop 14');
      expect(text).toContain('10.05.2026');
      const img = el.querySelector('app-case-summary-panel img') as HTMLImageElement;
      expect(img.getAttribute('src')).toBe('/api/cases/dbd4a315-cd94-430b-a23b-5e7e9c2f4fff/photo');
      expect(badge()).toContain('Wymaga weryfikacji');
    });

    it('restores the stored history; agent markdown is rendered, not shown raw (AC-29)', () => {
      const agent = bubbles('AGENT');
      expect(agent.length).toBeGreaterThan(0);
      expect(agent[0].querySelector('h3')?.textContent).toBe('Uzasadnienie');
      expect(agent[0].querySelector('strong')).toBeTruthy();
      expect(agent[0].textContent).not.toContain('###');
      expect(agent[0].textContent).toContain('To jest wstępna ocena.');
    });

    it('does not show the typing indicator when idle', () => {
      expect(el.querySelector('[data-testid=typing]')).toBeNull();
    });
  });

  it('shows the return case summary', async () => {
    await open({ get: 'case-view-return-phone-3' });
    expect(el.querySelector('app-case-summary-panel')!.textContent).toContain('Zwrot');
  });

  it('shows "Nie znaleziono zgłoszenia" with a link to a new case on 404 (PRD 9.3)', async () => {
    await open({ get: 'case-view-404' });
    expect(el.textContent).toContain('Nie znaleziono zgłoszenia');
    const link = el.querySelector('a[href="/"]');
    expect(link?.textContent).toContain('Nowe zgłoszenie');
    expect(el.querySelector('textarea')).toBeNull();
  });

  describe('sending messages', () => {
    it('sends plain text, shows it as customer message, then the authoritative agent reply (AC-25..27)', async () => {
      await open({ get: 'case-view-200', post: 'chat-unchanged' });
      const before = bubbles('AGENT').length;
      await type('Jaką datę zakupu podałem?');
      expect(el.textContent).toContain('25/2000');
      await send();
      expect(JSON.parse(posts[0])).toEqual({ content: 'Jaką datę zakupu podałem?' });
      const customer = bubbles('CUSTOMER');
      expect(customer.at(-1)!.textContent).toContain('Jaką datę zakupu podałem?');
      const agent = bubbles('AGENT');
      expect(agent.length).toBe(before + 1);
      const finalContent = (JSON.parse(CAPTURES['chat-unchanged'].response.body.split('event: completed\ndata: ')[1]) as {
        message: { content: string };
      }).message.content;
      expect(agent.at(-1)!.textContent).toContain('10 maja 2026 r.');
      expect(agent.at(-1)!.querySelector('strong')?.textContent).toBe('10 maja 2026 r.');
      expect(finalContent).toContain('10 maja 2026');
      expect(await (await input()).getValue()).toBe('');
      expect(await (await sendBtn()).isDisabled()).toBe(true); // empty input
      expect(el.querySelector('[data-testid=typing]')).toBeNull();
    });

    it('cannot send empty or whitespace-only text (AC-25)', async () => {
      await open({ get: 'case-view-200', post: 'chat-unchanged' });
      expect(await (await sendBtn()).isDisabled()).toBe(true);
      await type('   ');
      expect(await (await sendBtn()).isDisabled()).toBe(true);
      await type('a');
      expect(await (await sendBtn()).isDisabled()).toBe(false);
    });

    it('limits input to 2000 characters and shows a counter', async () => {
      await open({ get: 'case-view-200', post: 'chat-unchanged' });
      await type('abc');
      expect(el.textContent).toContain('3/2000');
      expect((el.querySelector('textarea') as HTMLTextAreaElement).maxLength).toBe(2000);
    });

    it('Enter sends, Shift+Enter inserts a newline (PRD 9.2)', async () => {
      await open({ get: 'case-view-200', post: 'chat-unchanged' });
      const i = await input();
      await i.setValue('linia 1');
      await (await i.host()).sendKeys({ shift: true }, TestKey.ENTER);
      await settle();
      expect(posts.length).toBe(0);
      await (await i.host()).sendKeys(TestKey.ENTER);
      await settle();
      expect(posts.length).toBe(1);
    });

    it('does nothing on Enter with empty text', async () => {
      await open({ get: 'case-view-200', post: 'chat-unchanged' });
      await (await (await input()).host()).sendKeys(TestKey.ENTER);
      await settle();
      expect(posts.length).toBe(0);
    });
  });

  describe('streaming (AC-27, AC-28)', () => {
    /** Response whose body is the real capture, released in parts under test control. */
    function gated(name: CaptureName) {
      const body = CAPTURES[name].response.body;
      const frames = body.split('\n\n').filter(Boolean).map((f) => f + '\n\n');
      const enc = new TextEncoder();
      let ctrl!: ReadableStreamDefaultController<Uint8Array>;
      const stream = new ReadableStream<Uint8Array>({ start: (c) => (ctrl = c) });
      const response = () =>
        new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
      let next = 0;
      return {
        response,
        frames,
        push(n: number) {
          for (let k = 0; k < n; k++) ctrl.enqueue(enc.encode(frames[next++]));
        },
        rest() {
          this.push(frames.length - next);
          ctrl.close();
        },
      };
    }

    it('typing indicator until first token; badge updates on assessment_changed before tokens; send disabled', async () => {
      const g = gated('chat-assessment-changed');
      await open({ get: 'case-view-200', post: () => g.response() });
      expect(badge()).toContain('Wymaga weryfikacji');
      await type('Chcę doprecyzować');
      await (await sendBtn()).click();
      await settle();
      expect(el.querySelector('[data-testid=typing]')).toBeTruthy();
      expect(await (await sendBtn()).isDisabled()).toBe(true);

      g.push(1); // assessment_changed only
      await settle();
      expect(badge()).toContain('Odrzucone wstępnie');
      expect(el.querySelector('[data-testid=typing]')).toBeTruthy();

      g.push(1); // first token
      await settle();
      expect(el.querySelector('[data-testid=typing]')).toBeNull();
      expect(bubbles('AGENT').at(-1)!.textContent).toContain('Wstępna ocena zmieniona');
      expect(await (await sendBtn()).isDisabled()).toBe(true);

      g.push(2);
      await settle();
      expect(bubbles('AGENT').at(-1)!.textContent).toContain('Wstępna ocena zmieniona');
      g.rest();
      await settle();
      const last = bubbles('AGENT').at(-1)!;
      expect(last.textContent).toContain('sklepie stacjonarnym');
      expect(badge()).toContain('Odrzucone wstępnie');
      await type('x');
      expect(await (await sendBtn()).isDisabled()).toBe(false);
    });

    it('Enter while streaming does nothing', async () => {
      const g = gated('chat-unchanged');
      await open({ get: 'case-view-200', post: () => g.response() });
      await type('pytanie');
      await (await sendBtn()).click();
      await settle();
      await (await (await input()).host()).sendKeys(TestKey.ENTER);
      await settle();
      expect(posts.length).toBe(1);
      g.rest();
      await settle();
    });
  });

  describe('errors (AC-31)', () => {
    it('SSE error event: removes local messages, restores text, offers "Wyślij ponownie" which resends', async () => {
      await open({ get: 'case-view-200', post: 'chat-error' });
      const customerBefore = bubbles('CUSTOMER').length;
      const agentBefore = bubbles('AGENT').length;
      await type('Ile trwa rozpatrzenie zgłoszenia?');
      await send();
      expect(bubbles('CUSTOMER').length).toBe(customerBefore);
      expect(bubbles('AGENT').length).toBe(agentBefore);
      expect(await (await input()).getValue()).toBe('Ile trwa rozpatrzenie zgłoszenia?');
      expect(el.textContent).toContain('Usługa jest chwilowo niedostępna. Spróbuj ponownie.');
      expect(el.querySelector('[data-testid=typing]')).toBeNull();
      const retry = await loader.getHarness(MatButtonHarness.with({ text: 'Wyślij ponownie' }));

      routes.post = 'chat-unchanged';
      await retry.click();
      await settle();
      expect(posts.length).toBe(2);
      expect(JSON.parse(posts[1])).toEqual({ content: 'Ile trwa rozpatrzenie zgłoszenia?' });
      expect(bubbles('AGENT').length).toBe(agentBefore + 1);
      expect(el.textContent).not.toContain('Wyślij ponownie');
      expect(await (await input()).getValue()).toBe('');
    });

    it('network failure behaves like an error event', async () => {
      await open({ get: 'case-view-200', post: () => Promise.reject(new TypeError('Failed to fetch')) });
      await type('Halo');
      await send();
      expect(await (await input()).getValue()).toBe('Halo');
      expect(el.textContent).toContain('Wyślij ponownie');
      expect(bubbles('CUSTOMER').some((b) => b.textContent!.includes('Halo'))).toBe(false);
    });

    it('interrupted stream behaves like an error event', async () => {
      const partial = () => {
        const body = CAPTURES['chat-unchanged'].response.body.split('\n\n').slice(0, 2).join('\n\n') + '\n\n';
        return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
      };
      await open({ get: 'case-view-200', post: partial });
      await type('Halo');
      await send();
      expect(await (await input()).getValue()).toBe('Halo');
      expect(el.textContent).toContain('Wyślij ponownie');
    });

    it('409 shows the "reply in progress" text and restores the message', async () => {
      await open({ get: 'case-view-200', post: 'chat-409-conflict' });
      await type('Drugie pytanie');
      await send();
      expect(el.textContent).toContain('Poprzednia odpowiedź jest jeszcze generowana.');
      expect(await (await input()).getValue()).toBe('Drugie pytanie');
      expect(el.textContent).toContain('Wyślij ponownie');
    });
  });
});
