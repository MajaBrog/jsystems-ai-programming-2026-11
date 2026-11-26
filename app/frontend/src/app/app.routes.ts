import { Routes } from '@angular/router';
import { CaseFormPage } from './features/case-form/case-form.page';
import { CaseChatPage } from './features/case-chat/case-chat.page';

export const routes: Routes = [
  { path: '', component: CaseFormPage },
  { path: 'case/:id', component: CaseChatPage },
  { path: '**', redirectTo: '' },
];
