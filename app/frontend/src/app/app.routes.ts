import { Routes } from '@angular/router';

/** Feature pages are lazy-loaded so Material form/chat + markdown stay out of the initial bundle. */
export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/case-form/case-form.page').then((m) => m.CaseFormPage) },
  { path: 'case/:id', loadComponent: () => import('./features/case-chat/case-chat.page').then((m) => m.CaseChatPage) },
  { path: '**', redirectTo: '' },
];
