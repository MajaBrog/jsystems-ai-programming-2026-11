import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { Router } from '@angular/router';
import { format } from 'date-fns';
import { CaseApi } from '../../core/case-api';
import { ApiError, CaseType, DEVICE_CATEGORIES, DeviceCategory } from '../../core/models';
import {
  CASE_TYPE_LABELS,
  DEVICE_CATEGORY_LABELS,
  STAGE_LABELS,
} from '../../shared/labels/labels';
import { FORMAT_ERROR, PhotoDropZone, SIZE_ERROR } from '../../shared/photo-drop-zone/photo-drop-zone';
import { MATERIAL_PAGE_PROVIDERS } from '../../core/i18n/material-page-providers';

export const SERVICE_UNAVAILABLE = 'Usługa jest chwilowo niedostępna. Spróbuj ponownie.';
export const MODEL_LENGTH_ERROR = 'Nazwa modelu musi mieć od 2 do 100 znaków.';
export const DESCRIPTION_REQUIRED_ERROR = 'Opisz usterkę i okoliczności jej powstania.';
export const DESCRIPTION_MAX = 2000;

const PHOTO_TIPS = 'Wskazówki: zadbaj o dobre światło, pokaż całe urządzenie i ustaw ostrość na uszkodzeniu.';

/** Unicode code points, matching how the backend counts characters. */
export const codePoints = (s: string): number => [...s].length;

const modelNameValidator = (control: AbstractControl<string>): ValidationErrors | null => {
  const length = codePoints((control.value ?? '').trim());
  if (length === 0) return { required: true };
  return length < 2 || length > 100 ? { modelLength: true } : null;
};

const descriptionBlank = (control: AbstractControl<string>): ValidationErrors | null =>
  (control.value ?? '').trim().length === 0 ? { required: true } : null;

@Component({
  selector: 'app-case-form-page',
  providers: [MATERIAL_PAGE_PROVIDERS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    PhotoDropZone,
  ],
  templateUrl: './case-form.page.html',
  styleUrl: './case-form.page.scss',
})
export class CaseFormPage {
  private readonly api = inject(CaseApi);
  private readonly router = inject(Router);
  private readonly abort = new AbortController();

  protected readonly caseTypes = Object.entries(CASE_TYPE_LABELS) as [CaseType, string][];
  protected readonly categories: { value: DeviceCategory; label: string }[] = DEVICE_CATEGORIES.map((value) => ({
    value,
    label: DEVICE_CATEGORY_LABELS[value],
  }));
  protected readonly today = new Date();
  protected readonly descriptionMax = DESCRIPTION_MAX;

  protected readonly form = new FormGroup({
    caseType: new FormControl<CaseType | null>(null, Validators.required),
    deviceCategory: new FormControl<DeviceCategory | null>(null, Validators.required),
    modelName: new FormControl('', { nonNullable: true, validators: modelNameValidator }),
    purchaseDate: new FormControl<Date | null>(null, Validators.required),
    description: new FormControl('', { nonNullable: true, validators: (c) => (codePoints(c.value) > DESCRIPTION_MAX ? { maxlength: true } : null) }),
    photo: new FormControl<File | null>(null, Validators.required),
  });

  protected readonly submitting = signal(false);
  protected readonly stageText = signal(STAGE_LABELS.ANALYZING_PHOTO);
  protected readonly photoAlert = signal<string | null>(null);
  protected readonly serviceError = signal<string | null>(null);
  protected readonly generalError = signal<string | null>(null);
  protected readonly caseType = signal<CaseType | null>(null);
  protected readonly descriptionLength = signal(0);

  protected readonly isComplaint = computed(() => this.caseType() === 'COMPLAINT');
  protected readonly descriptionLabel = computed(() =>
    this.isComplaint() ? 'Opisz usterkę i okoliczności jej powstania' : 'Powód zwrotu (opcjonalnie)',
  );
  protected readonly photoHint = computed(() => {
    switch (this.caseType()) {
      case 'COMPLAINT':
        return 'Pokaż uszkodzenie';
      case 'RETURN':
        return 'Pokaż, że urządzenie nie jest uszkodzone';
      default:
        return '';
    }
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.abort.abort());
    const { caseType, description } = this.form.controls;
    caseType.valueChanges.subscribe((type) => {
      this.caseType.set(type);
      if (type === 'COMPLAINT') description.addValidators(descriptionBlank);
      else description.removeValidators(descriptionBlank);
      description.updateValueAndValidity();
    });
    description.valueChanges.subscribe((v) => this.descriptionLength.set(codePoints(v)));
  }

  /** Message for the first error on a control (server errors take precedence); null when it should not show. */
  protected errorOf(name: keyof CaseFormPage['form']['controls']): string | null {
    const control = this.form.controls[name];
    if (!control.errors || !(control.touched || control.dirty)) return null;
    const e = control.errors;
    if (e['server']) return e['server'] as string;
    switch (name) {
      case 'caseType':
        return 'Wybierz rodzaj zgłoszenia.';
      case 'deviceCategory':
        return 'Wybierz kategorię urządzenia.';
      case 'modelName':
        return e['required'] ? 'Podaj nazwę modelu.' : MODEL_LENGTH_ERROR;
      case 'purchaseDate':
        if (e['matDatepickerMax']) return 'Data zakupu nie może być z przyszłości.';
        if (e['matDatepickerParse']) return 'Podaj datę w formacie dd.mm.rrrr.';
        return 'Wybierz datę zakupu.';
      case 'description':
        return e['maxlength'] ? 'Opis może mieć maksymalnie 2000 znaków.' : DESCRIPTION_REQUIRED_ERROR;
      case 'photo':
        return 'Dodaj zdjęcie urządzenia.';
    }
  }

  protected async submit(): Promise<void> {
    if (this.submitting()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.photoAlert.set(null);
    this.serviceError.set(null);
    this.generalError.set(null);
    this.stageText.set(STAGE_LABELS.ANALYZING_PHOTO);
    const body = this.buildFormData();
    this.submitting.set(true);
    this.form.disable({ emitEvent: false });

    let failure: unknown;
    try {
      for await (const event of this.api.submitCase(body, this.abort.signal)) {
        switch (event.type) {
          case 'stage':
            this.stageText.set(STAGE_LABELS[event.stage]);
            break;
          case 'photo_unusable':
            this.photoAlert.set(event.message);
            this.form.controls.photo.reset(null, { emitEvent: false });
            break;
          case 'error':
            this.serviceError.set(SERVICE_UNAVAILABLE);
            break;
          case 'completed':
            await this.router.navigate(['/case', event.caseId]);
            return;
        }
      }
    } catch (e) {
      failure = e;
    }
    if (this.abort.signal.aborted) return;
    // Re-enable first: enabling recalculates validity and would wipe server errors set below.
    this.submitting.set(false);
    this.form.enable({ emitEvent: false });
    if (failure !== undefined) this.handleFailure(failure);
  }

  protected readonly unusableTips = PHOTO_TIPS;

  private handleFailure(e: unknown): void {
    if (!(e instanceof ApiError)) {
      this.serviceError.set(SERVICE_UNAVAILABLE);
      return;
    }
    const controls = this.form.controls as Record<string, AbstractControl>;
    switch (e.code) {
      case 'VALIDATION_FAILED': {
        const unmatched: string[] = [];
        for (const fe of e.fieldErrors) {
          const control = controls[fe.field];
          if (control) {
            control.setErrors({ server: fe.message });
            control.markAsTouched();
          } else unmatched.push(fe.message);
        }
        if (e.fieldErrors.length === 0 || unmatched.length > 0) {
          this.generalError.set(unmatched.join(' ') || e.message);
        }
        break;
      }
      case 'FILE_TOO_LARGE':
        this.form.controls.photo.setErrors({ server: SIZE_ERROR });
        this.form.controls.photo.markAsTouched();
        break;
      case 'UNSUPPORTED_IMAGE':
        this.form.controls.photo.setErrors({ server: FORMAT_ERROR });
        this.form.controls.photo.markAsTouched();
        break;
      default:
        this.serviceError.set(SERVICE_UNAVAILABLE);
    }
  }

  private buildFormData(): FormData {
    const v = this.form.getRawValue();
    const body = new FormData();
    body.set('caseType', v.caseType!);
    body.set('deviceCategory', v.deviceCategory!);
    body.set('modelName', v.modelName.trim());
    body.set('purchaseDate', format(v.purchaseDate!, 'yyyy-MM-dd'));
    const description = v.description.trim();
    if (description) body.set('description', description);
    body.set('photo', v.photo!);
    return body;
  }
}
