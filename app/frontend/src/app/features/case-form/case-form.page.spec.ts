import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatButtonToggleGroupHarness } from '@angular/material/button-toggle/testing';
import { MAT_DATE_FORMATS, MAT_DATE_LOCALE } from '@angular/material/core';
import { MatDatepickerInputHarness } from '@angular/material/datepicker/testing';
import { MatInputHarness } from '@angular/material/input/testing';
import { MatProgressBarHarness } from '@angular/material/progress-bar/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { provideDateFnsAdapter } from '@angular/material-date-fns-adapter';
import { Router, provideRouter } from '@angular/router';
import { format, addDays } from 'date-fns';
import { pl } from 'date-fns/locale';
import { PL_DATE_FORMATS } from '../../app.config';
import { CAPTURES, CaptureName, captureResponse } from '../../../testing/capture-response';
import { FETCH } from '../../core/case-api';
import { loadExampleImage } from '../../shared/photo-drop-zone/example-images.testing';
import { CaseFormPage } from './case-form.page';

type FetchCall = { url: string; init?: RequestInit };

/** Replays the recorded capture bytes but withholds everything from `event: <holdFrom>` until released. */
function gatedResponse(name: CaptureName, holdFrom: string, release: Promise<void>, closeAfterGate = false) {
  const body = CAPTURES[name].response.body;
  const idx = body.indexOf(`event: ${holdFrom}`);
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(c) {
      c.enqueue(enc.encode(body.slice(0, idx)));
      await release;
      if (!closeAfterGate) c.enqueue(enc.encode(body.slice(idx)));
      c.close();
    },
  });
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

describe('CaseFormPage', () => {
  let fixture: ComponentFixture<CaseFormPage>;
  let loader: HarnessLoader;
  let calls: FetchCall[];
  let navigate: ReturnType<typeof vi.fn>;
  let respond: (call: number) => Response | Promise<Response>;

  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent ?? '';
  const errorOf = (field: string) => el().querySelector(`[data-error="${field}"]`)?.textContent?.trim() ?? null;
  const alertText = () => el().querySelector('[role=alert].form-alert')?.textContent ?? '';
  const settle = async () => {
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 0));
    await fixture.whenStable();
  };

  async function pickPhoto(name: string) {
    const input: HTMLInputElement = el().querySelector('input[type=file]')!;
    Object.defineProperty(input, 'files', { value: [await loadExampleImage(name)], configurable: true });
    input.dispatchEvent(new Event('change'));
    await settle();
  }

  async function fillValid(opts: { type?: 'Reklamacja' | 'Zwrot'; description?: string; photo?: string } = {}) {
    const group = await loader.getHarness(MatButtonToggleGroupHarness);
    await (await group.getToggles({ text: opts.type ?? 'Zwrot' }))[0].check();
    const select = await loader.getHarness(MatSelectHarness);
    await select.clickOptions({ text: 'Laptop' });
    await (await input('modelName')).setValue('Testowy Laptop 14');
    await (await loader.getHarness(MatDatepickerInputHarness)).setValue('10.05.2026');
    if (opts.description !== undefined) await (await input('description')).setValue(opts.description);
    await pickPhoto(opts.photo ?? 'laptop-1.png');
  }

  const input = (name: string) => loader.getHarness(MatInputHarness.with({ selector: `[formControlName=${name}]` }));
  const submitButton = () => loader.getHarness(MatButtonHarness.with({ text: 'Wyślij zgłoszenie' }));

  beforeEach(async () => {
    calls = [];
    navigate = vi.fn().mockResolvedValue(true);
    respond = () => captureResponse('submit-completed-return-phone-3', 7);
    URL.createObjectURL = () => 'blob:preview';
    URL.revokeObjectURL = () => undefined;
    const fetchStub: typeof fetch = (url, init) => {
      calls.push({ url: String(url), init });
      return Promise.resolve(respond(calls.length - 1));
    };
    await TestBed.configureTestingModule({
      imports: [CaseFormPage],
      providers: [
        provideRouter([]),
        provideDateFnsAdapter(PL_DATE_FORMATS),
        { provide: MAT_DATE_LOCALE, useValue: pl },
        { provide: MAT_DATE_FORMATS, useValue: PL_DATE_FORMATS },
        { provide: LOCALE_ID, useValue: 'pl' },
        { provide: FETCH, useValue: fetchStub },
      ],
    }).compileComponents();
    vi.spyOn(TestBed.inject(Router), 'navigate').mockImplementation(navigate as never);
    fixture = TestBed.createComponent(CaseFormPage);
    loader = TestbedHarnessEnvironment.loader(fixture);
    await fixture.whenStable();
  });

  describe('layout (PRD 9.1)', () => {
    it('shows the heading, nothing preselected, 13 Polish categories and the placeholder', async () => {
      expect(el().querySelector('h1')?.textContent).toContain('Nowe zgłoszenie');
      const group = await loader.getHarness(MatButtonToggleGroupHarness);
      const toggles = await group.getToggles();
      expect(await Promise.all(toggles.map((t) => t.getText()))).toEqual(['Reklamacja', 'Zwrot']);
      expect(await Promise.all(toggles.map((t) => t.isChecked()))).toEqual([false, false]);
      const select = await loader.getHarness(MatSelectHarness);
      await select.open();
      const options = await select.getOptions();
      expect(options.length).toBe(13);
      expect(await options[0].getText()).toBe('Smartfon');
      expect(await options[12].getText()).toBe('Inne');
      expect(el().querySelector<HTMLInputElement>('[formControlName=modelName]')?.placeholder).toBe(
        'np. Galaxy S24, ThinkPad T14',
      );
    });

    it('shows a photo hint depending on the case type', async () => {
      const group = await loader.getHarness(MatButtonToggleGroupHarness);
      await (await group.getToggles({ text: 'Reklamacja' }))[0].check();
      expect(text()).toContain('Pokaż uszkodzenie');
      await (await group.getToggles({ text: 'Zwrot' }))[0].check();
      expect(text()).toContain('Pokaż, że urządzenie nie jest uszkodzone');
    });
  });

  describe('validation', () => {
    it('empty submit sends no request and shows an inline error under each required field (AC-02, AC-09)', async () => {
      await (await submitButton()).click();
      await settle();
      expect(calls.length).toBe(0);
      for (const field of ['caseType', 'deviceCategory', 'modelName', 'purchaseDate', 'photo']) {
        expect(errorOf(field), field).toBeTruthy();
      }
      expect(errorOf('description')).toBeNull();
    });

    it('validates on blur without submit (PRD 9.1)', async () => {
      const model = await input('modelName');
      expect(errorOf('modelName')).toBeNull();
      await model.focus();
      await model.blur();
      expect(errorOf('modelName')).toBeTruthy();
    });

    it('requires description for Complaint only and toggles the marker/label without clearing text (AC-03)', async () => {
      const group = await loader.getHarness(MatButtonToggleGroupHarness);
      const description = await input('description');
      const marker = () => el().querySelectorAll('.description-field .mat-mdc-form-field-required-marker').length;
      const label = () => el().querySelector('.description-field label')?.textContent ?? '';

      await (await group.getToggles({ text: 'Reklamacja' }))[0].check();
      expect(label()).toContain('Opisz usterkę i okoliczności jej powstania');
      expect(marker()).toBe(1);
      await description.setValue('Pęknięta obudowa');

      await (await group.getToggles({ text: 'Zwrot' }))[0].check();
      expect(label()).toContain('Powód zwrotu (opcjonalnie)');
      expect(marker()).toBe(0);
      expect(await description.getValue()).toBe('Pęknięta obudowa');

      await (await group.getToggles({ text: 'Reklamacja' }))[0].check();
      expect(marker()).toBe(1);
      expect(await description.getValue()).toBe('Pęknięta obudowa');
    });

    it('blank description is invalid for Complaint and valid for Return', async () => {
      const group = await loader.getHarness(MatButtonToggleGroupHarness);
      const description = await input('description');
      await (await group.getToggles({ text: 'Reklamacja' }))[0].check();
      await description.setValue('   ');
      await description.blur();
      expect(errorOf('description')).toBe('Opisz usterkę i okoliczności jej powstania.');
      await (await group.getToggles({ text: 'Zwrot' }))[0].check();
      expect(errorOf('description')).toBeNull();
    });

    it('rejects a future purchase date with the AC-04 text and accepts today', async () => {
      const date = await loader.getHarness(MatDatepickerInputHarness);
      await date.setValue(format(addDays(new Date(), 1), 'dd.MM.yyyy'));
      await date.blur();
      expect(errorOf('purchaseDate')).toBe('Data zakupu nie może być z przyszłości.');
      await date.setValue(format(new Date(), 'dd.MM.yyyy'));
      await date.blur();
      expect(errorOf('purchaseDate')).toBeNull();
    });

    it.each([
      ['X', true],
      ['  X  ', true],
      ['Ab', false],
      ['a'.repeat(100), false],
      ['a'.repeat(101), true],
    ])('model name %j invalid=%s (AC-05, 2-100 after trim)', async (value, invalid) => {
      const model = await input('modelName');
      await model.setValue(value);
      await model.blur();
      expect(errorOf('modelName')).toBe(invalid ? 'Nazwa modelu musi mieć od 2 do 100 znaków.' : null);
    });

    it('shows a description counter n/2000 and rejects 2001 characters (AC-05)', async () => {
      const description = await input('description');
      await description.setValue('abc');
      expect(text()).toContain('3/2000');
      await description.setValue('a'.repeat(2001));
      await description.blur();
      expect(text()).toContain('2001/2000');
      expect(errorOf('description')).toBe('Opis może mieć maksymalnie 2000 znaków.');
    });
  });

  describe('submission', () => {
    it('sends multipart FormData with exact fields (date yyyy-MM-dd, empty description omitted)', async () => {
      await fillValid();
      await (await submitButton()).click();
      await settle();
      expect(calls.length).toBe(1);
      expect(calls[0].url).toBe('/api/cases');
      expect(calls[0].init?.method).toBe('POST');
      expect(calls[0].init?.headers).toBeUndefined();
      const body = calls[0].init?.body as FormData;
      expect(body.get('caseType')).toBe('RETURN');
      expect(body.get('deviceCategory')).toBe('LAPTOP');
      expect(body.get('modelName')).toBe('Testowy Laptop 14');
      expect(body.get('purchaseDate')).toBe('2026-05-10');
      expect(body.has('description')).toBe(false);
      expect((body.get('photo') as File).name).toBe('laptop-1.png');
    });

    it('includes the trimmed description when given', async () => {
      await fillValid({ type: 'Reklamacja', description: '  Nie włącza się  ' });
      await (await submitButton()).click();
      await settle();
      const body = calls[0].init?.body as FormData;
      expect(body.get('caseType')).toBe('COMPLAINT');
      expect(body.get('description')).toBe('Nie włącza się');
    });

    it('while processing: stage texts, locked form, disabled button, progress bar, no second request (AC-10); then navigates on completed', async () => {
      let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      respond = () => gatedResponse('submit-completed-return-phone-3', 'completed', gate);
      await fillValid();
      const button = await submitButton();
      await button.click();
      await settle();

      expect(text()).toContain('Przygotowujemy ocenę…'); // recorded stage ASSESSING already received
      expect(await button.isDisabled()).toBe(true);
      expect(await loader.getAllHarnesses(MatProgressBarHarness)).toHaveLength(1);
      expect(await (await input('modelName')).isDisabled()).toBe(true);
      expect(await (await loader.getHarness(MatSelectHarness)).isDisabled()).toBe(true);
      expect(await (await loader.getHarness(MatButtonToggleGroupHarness)).getToggles()).toHaveLength(2);
      el().querySelector('form')!.dispatchEvent(new Event('submit'));
      await settle();
      expect(calls.length).toBe(1);
      expect(navigate).not.toHaveBeenCalled();

      release();
      await settle();
      const caseId = JSON.parse(
        CAPTURES['submit-completed-return-phone-3'].response.body.match(/data: (\{"caseId".*\})/)![1],
      ).caseId;
      expect(navigate).toHaveBeenCalledWith(['/case', caseId]);
    });

    it('starts with the "Analizujemy zdjęcie…" stage text before any server event', async () => {
      respond = () => new Promise<Response>(() => undefined); // never answers
      await fillValid();
      await (await submitButton()).click();
      await settle();
      expect(text()).toContain('Analizujemy zdjęcie…');
      expect(await (await submitButton()).isDisabled()).toBe(true);
    });

    it('photo_unusable: shows the server message with tips, keeps values, clears only the photo (AC-14)', async () => {
      respond = () => captureResponse('submit-photo-unusable');
      await fillValid({ photo: 'phone-2.jpeg' });
      await (await submitButton()).click();
      await settle();

      const serverMessage = JSON.parse(
        CAPTURES['submit-photo-unusable'].response.body.match(/data: (\{"reason".*\})/)![1],
      ).message;
      expect(alertText()).toContain(serverMessage);
      expect(alertText()).toMatch(/światł/i);
      expect(navigate).not.toHaveBeenCalled();
      expect(await (await input('modelName')).getValue()).toBe('Testowy Laptop 14');
      expect(await (await loader.getHarness(MatSelectHarness)).getValueText()).toBe('Laptop');
      expect(await (await loader.getHarness(MatDatepickerInputHarness)).getValue()).toBe('10.05.2026');
      expect(await (await (await loader.getHarness(MatButtonToggleGroupHarness)).getToggles({ checked: true }))[0].getText()).toBe('Zwrot');
      expect(el().querySelector('img.preview')).toBeNull();
      expect(text()).not.toContain('phone-2.jpeg');
      expect(await (await submitButton()).isDisabled()).toBe(false);
      expect(await (await input('modelName')).isDisabled()).toBe(false);

      // Submitting again without a new photo is blocked by the required-photo rule.
      await (await submitButton()).click();
      await settle();
      expect(calls.length).toBe(1);
      expect(errorOf('photo')).toBeTruthy();
    });

    it('clears the unusable-photo alert when a new photo is submitted', async () => {
      respond = (n) => (n === 0 ? captureResponse('submit-photo-unusable') : captureResponse('submit-completed-return-phone-3'));
      await fillValid({ photo: 'phone-2.jpeg' });
      await (await submitButton()).click();
      await settle();
      await pickPhoto('phone-3.jpeg');
      await (await submitButton()).click();
      await settle();
      expect(calls.length).toBe(2);
      expect((calls[1].init?.body as FormData).get('photo') as File).toHaveProperty('name', 'phone-3.jpeg');
      expect(alertText()).toBe('');
      expect(navigate).toHaveBeenCalledOnce();
    });

    it('error event: AC-30 message, ALL values incl. photo kept, retry resubmits the same data', async () => {
      respond = (n) => (n === 0 ? captureResponse('submit-error') : captureResponse('submit-completed-return-phone-3'));
      await fillValid({ type: 'Reklamacja', description: 'Nie włącza się', photo: 'phone-1.jpg' });
      await (await submitButton()).click();
      await settle();

      expect(alertText()).toContain('Usługa jest chwilowo niedostępna. Spróbuj ponownie.');
      expect(navigate).not.toHaveBeenCalled();
      expect(text()).toContain('phone-1.jpg');
      expect(el().querySelector('img.preview')).not.toBeNull();
      expect(await (await input('modelName')).getValue()).toBe('Testowy Laptop 14');
      expect(await (await input('description')).getValue()).toBe('Nie włącza się');

      const retry = await loader.getHarness(MatButtonHarness.with({ text: 'Spróbuj ponownie' }));
      await retry.click();
      await settle();
      expect(calls.length).toBe(2);
      const first = calls[0].init?.body as FormData;
      const second = calls[1].init?.body as FormData;
      expect([...second.keys()].sort()).toEqual([...first.keys()].sort());
      expect(second.get('modelName')).toBe(first.get('modelName'));
      expect((second.get('photo') as File).name).toBe('phone-1.jpg');
      expect(navigate).toHaveBeenCalledOnce();
      expect(alertText()).toBe('');
    });

    it('network failure is treated as AC-30, values kept', async () => {
      respond = () => Promise.reject(new TypeError('Failed to fetch'));
      await fillValid({ photo: 'phone-1.jpg' });
      await (await submitButton()).click();
      await settle();
      expect(alertText()).toContain('Usługa jest chwilowo niedostępna. Spróbuj ponownie.');
      expect(text()).toContain('phone-1.jpg');
      expect(await (await submitButton()).isDisabled()).toBe(false);
    });

    it('interrupted stream (no terminal event) is treated as AC-30, values kept', async () => {
      respond = () => gatedResponse('submit-completed-return-phone-3', 'completed', Promise.resolve(), true);
      await fillValid({ photo: 'phone-1.jpg' });
      await (await submitButton()).click();
      await settle();
      expect(alertText()).toContain('Usługa jest chwilowo niedostępna. Spróbuj ponownie.');
      expect(text()).toContain('phone-1.jpg');
      expect(navigate).not.toHaveBeenCalled();
    });

    it('400 maps server field errors onto the matching fields and keeps all values', async () => {
      respond = () => captureResponse('submit-400-validation');
      await fillValid({ type: 'Reklamacja', description: 'x', photo: 'phone-1.jpg' });
      await (await submitButton()).click();
      await settle();

      expect(calls.length).toBe(1);
      expect(errorOf('modelName')).toBe('Nazwa modelu musi mieć od 2 do 100 znaków.');
      expect(errorOf('purchaseDate')).toBe('Data zakupu nie może być z przyszłości.');
      expect(errorOf('description')).toBe('Opisz usterkę i okoliczności jej powstania.');
      expect(navigate).not.toHaveBeenCalled();
      expect(text()).toContain('phone-1.jpg');
      expect(await (await submitButton()).isDisabled()).toBe(false);
    });

    it('a server field error disappears when the user edits that field', async () => {
      respond = () => captureResponse('submit-400-validation');
      await fillValid({ type: 'Reklamacja', description: 'x' });
      await (await submitButton()).click();
      await settle();
      const model = await input('modelName');
      await model.setValue('Nowy model');
      await model.blur();
      expect(errorOf('modelName')).toBeNull();
    });
  });
});
