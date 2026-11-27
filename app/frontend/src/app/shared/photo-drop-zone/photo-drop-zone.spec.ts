import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { loadExampleImage } from './example-images.testing';
import { PhotoDropZone } from './photo-drop-zone';

@Component({
  imports: [PhotoDropZone, ReactiveFormsModule],
  template: `<app-photo-drop-zone [formControl]="photo" hint="Pokaż uszkodzenie" />`,
})
class Host {
  readonly photo = new FormControl<File | null>(null);
}

function textFile(name: string, content: string, type = 'text/plain'): File {
  return new File([content], name, { type });
}

function pick(fixture: ComponentFixture<Host>, file: File) {
  const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type=file]');
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change'));
}

function drop(fixture: ComponentFixture<Host>, file: File) {
  const zone: HTMLElement = fixture.nativeElement.querySelector('.drop-zone');
  const event = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: { files: [file] } });
  zone.dispatchEvent(event);
}

const alertText = (f: ComponentFixture<Host>) =>
  f.nativeElement.querySelector('[role=alert]')?.textContent?.trim() ?? null;

describe('PhotoDropZone', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let revoked: string[];
  let counter: number;

  beforeEach(async () => {
    counter = 0;
    revoked = [];
    URL.createObjectURL = () => `blob:preview-${++counter}`;
    URL.revokeObjectURL = (u: string) => void revoked.push(u);
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('accepts only JPEG, PNG and WEBP in the file picker and shows the hint and limits', () => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type=file]');
    expect(input.accept).toBe('image/jpeg,image/png,image/webp');
    expect(input.multiple).toBe(false);
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Wybierz plik');
    expect(text).toContain('Pokaż uszkodzenie');
    expect(text).toContain('JPG, PNG, WEBP');
    expect(text).toContain('10 MB');
  });

  it.each([
    ['phone-1.jpg', 'image/jpeg'],
    ['laptop-2.webp', 'image/webp'],
    ['phone-3.jpeg', 'image/jpeg'],
  ])('accepts the real photo %s and shows preview with file name', async (name, type) => {
    const file = await loadExampleImage(name, type);
    pick(fixture, file);
    await fixture.whenStable();
    expect(host.photo.value).toBe(file);
    const img: HTMLImageElement = fixture.nativeElement.querySelector('img.preview');
    expect(img.getAttribute('src')).toBe('blob:preview-1');
    expect(fixture.nativeElement.textContent).toContain(name);
    expect(alertText(fixture)).toBeNull();
  });

  it('accepts laptop-1.png whose content is JPEG', async () => {
    const file = await loadExampleImage('laptop-1.png');
    pick(fixture, file);
    await fixture.whenStable();
    expect(host.photo.value).toBe(file);
    expect(alertText(fixture)).toBeNull();
  });

  it('accepts a photo dropped onto the zone', async () => {
    const file = await loadExampleImage('phone-2.jpeg');
    drop(fixture, file);
    await fixture.whenStable();
    expect(host.photo.value).toBe(file);
  });

  it('rejects a text file with the AC-07 message and keeps no preview', async () => {
    pick(fixture, textFile('notatka.txt', 'to nie jest obraz'));
    await fixture.whenStable();
    expect(alertText(fixture)).toBe('Dozwolone formaty: JPG, PNG, WEBP.');
    expect(host.photo.value).toBeNull();
    expect(fixture.nativeElement.querySelector('img.preview')).toBeNull();
  });

  it('rejects by content, not by extension or MIME type (text named .png)', async () => {
    pick(fixture, textFile('udaje.png', 'GIF89a nie jest dozwolone', 'image/png'));
    await fixture.whenStable();
    expect(alertText(fixture)).toBe('Dozwolone formaty: JPG, PNG, WEBP.');
    expect(host.photo.value).toBeNull();
  });

  it('rejects a file larger than 10 MB with the AC-08 message and accepts exactly 10 MB', async () => {
    const real = await loadExampleImage('phone-1.jpg');
    const sized = (size: number) => {
      Object.defineProperty(real, 'size', { value: size, configurable: true });
      return real;
    };
    pick(fixture, sized(10 * 1024 * 1024 + 1));
    await fixture.whenStable();
    expect(alertText(fixture)).toBe('Plik przekracza limit 10 MB.');
    expect(host.photo.value).toBeNull();

    pick(fixture, sized(10 * 1024 * 1024));
    await fixture.whenStable();
    expect(alertText(fixture)).toBeNull();
    expect(host.photo.value).toBe(real);
  });

  it('replaces the first photo with a second one and revokes the old preview (AC-06)', async () => {
    const first = await loadExampleImage('phone-1.jpg');
    const second = await loadExampleImage('phone-2.jpeg');
    pick(fixture, first);
    await fixture.whenStable();
    pick(fixture, second);
    await fixture.whenStable();
    expect(host.photo.value).toBe(second);
    expect(fixture.nativeElement.querySelectorAll('img.preview').length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('phone-2.jpeg');
    expect(revoked).toEqual(['blob:preview-1']);
  });

  it('removes the photo with the remove button', async () => {
    pick(fixture, await loadExampleImage('phone-1.jpg'));
    await fixture.whenStable();
    fixture.nativeElement.querySelector('button[aria-label="Usuń zdjęcie"]').click();
    await fixture.whenStable();
    expect(host.photo.value).toBeNull();
    expect(fixture.nativeElement.querySelector('img.preview')).toBeNull();
    expect(revoked).toEqual(['blob:preview-1']);
  });

  it('clears preview when the form control is reset programmatically', async () => {
    pick(fixture, await loadExampleImage('phone-1.jpg'));
    await fixture.whenStable();
    host.photo.reset();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('img.preview')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('phone-1.jpg');
  });

  it('revokes the preview URL on destroy', async () => {
    pick(fixture, await loadExampleImage('phone-1.jpg'));
    await fixture.whenStable();
    fixture.destroy();
    expect(revoked).toEqual(['blob:preview-1']);
  });

  it('marks the control touched after a selection attempt', async () => {
    pick(fixture, textFile('x.txt', 'x'));
    await fixture.whenStable();
    expect(host.photo.touched).toBe(true);
  });

  it('is not interactive while the control is disabled', async () => {
    host.photo.disable();
    await fixture.whenStable();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type=file]');
    expect(input.disabled).toBe(true);
    drop(fixture, await loadExampleImage('phone-1.jpg'));
    await fixture.whenStable();
    expect(host.photo.value).toBeNull();
  });
});
