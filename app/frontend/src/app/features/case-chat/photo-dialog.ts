import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'app-photo-dialog',
  imports: [MatDialogModule],
  styles: `img { max-width: 100%; max-height: 80vh; display: block; margin: 0 auto; }`,
  template: `
    <mat-dialog-content><img [src]="url" alt="Zdjęcie urządzenia w powiększeniu" /></mat-dialog-content>
    <mat-dialog-actions align="end"><button type="button" class="btn btn-light" mat-dialog-close>Zamknij</button></mat-dialog-actions>
  `,
})
export class PhotoDialog {
  protected readonly url = inject<string>(MAT_DIALOG_DATA);
}
