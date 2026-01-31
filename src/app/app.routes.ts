import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

import { LoginComponent } from './pages/auth/login.component';
import { RegisterComponent } from './pages/auth/register.component';
import { LayoutComponent } from './pages/layout/layout.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { SubscribersComponent } from './pages/subscribers/subscribers.component';
import { CreateNewsletterComponent } from './pages/create-newsletter/create-newsletter.component';
import { NewslettersComponent } from './pages/newsletters/newsletters.component';
import { NewsletterPreviewComponent } from './pages/newsletters/newsletter-preview.component';
import { JobStatusComponent } from './pages/jobs/job-status.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'app' },

  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },

  {
    path: 'app',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'subscribers', component: SubscribersComponent },
      { path: 'create', component: CreateNewsletterComponent },
      { path: 'newsletters', component: NewslettersComponent },
      { path: 'newsletters/:id', component: NewsletterPreviewComponent },
      { path: 'jobs/:jobId', component: JobStatusComponent },
    ],
  },

  { path: '**', redirectTo: 'app' },
];
