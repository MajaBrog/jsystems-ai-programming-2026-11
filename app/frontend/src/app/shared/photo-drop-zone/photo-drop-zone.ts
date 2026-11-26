import { ChangeDetectionStrategy, Component, OnDestroy, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const FORMAT_ERROR = 'Dozwolone formaty: JPG, PNG, WEBP.';
export const SIZE_ERROR = 'Plik przekracza limit 10 MB.';

/** True when the leading bytes are a JPEG, PNG or WEBP signature (the extension and MIME type are ignored). */
export function hasImageSignature(b: Uint8Array): boolean {
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  const jpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v);
  const webp = ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
  return jpeg || png || webp;
}

/** Single-photo picker (click or drag & drop), `ControlValueAccessor<File | null>`. */
@Component({
  selector: 'app-photo-drop-zone',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => PhotoDropZone), multi: true }],
  templateUrl: './photo-drop-zone.html',
  styleUrl: './photo-drop-zone.scss',
})
export class PhotoDropZone implements ControlValueAccessor, OnDestroy {
  /** Case-type dependent hint shown inside the zone. */
  readonly hint = input('');
  /** External error (e.g. "photo required", server error); own file errors take precedence. */
  readonly error = input<string | null>(null);

  protected readonly file = signal<File | null>(null);
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly fileError = signal<string | null>(null);
  protected readonly disabled = signal(false);
  protected readonly dragging = signal(false);

  private onChange: (value: File | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: File | null): void {
    this.fileError.set(null);
    this.setFile(value ?? null);
  }
  registerOnChange(fn: (value: File | null) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  ngOnDestroy(): void {
    this.revokePreview();
  }

  protected onInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const picked = input.files?.[0];
    void this.accept(picked ?? null);
    input.value = '';
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (!this.disabled()) this.dragging.set(true);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    if (this.disabled()) return;
    void this.accept(event.dataTransfer?.files?.[0] ?? null);
  }

  protected remove(): void {
    this.fileError.set(null);
    this.setFile(null);
    this.onChange(null);
    this.onTouched();
  }

  protected touched(): void {
    this.onTouched();
  }

  private async accept(picked: File | null): Promise<void> {
    if (!picked) return;
    const error = await this.validate(picked);
    this.fileError.set(error);
    this.setFile(error ? null : picked);
    this.onChange(error ? null : picked);
    this.onTouched();
  }

  private async validate(file: File): Promise<string | null> {
    if (file.size > MAX_PHOTO_BYTES) return SIZE_ERROR;
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    return hasImageSignature(head) ? null : FORMAT_ERROR;
  }

  private setFile(file: File | null): void {
    this.revokePreview();
    this.file.set(file);
    if (file) this.previewUrl.set(URL.createObjectURL(file));
  }

  private revokePreview(): void {
    const url = this.previewUrl();
    if (url) URL.revokeObjectURL(url);
    this.previewUrl.set(null);
  }
}
