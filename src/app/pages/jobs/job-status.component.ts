import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService, JobStatusDto } from '../../core/api.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <h1>Job status</h1>

    <div class="card">
      <div><b>Job:</b> {{jobId}}</div>
      <div><b>Status:</b> {{status?.status}}</div>
      <div *ngIf="status?.progress != null"><b>Progress:</b> {{status?.progress}}%</div>
      <div class="error" *ngIf="status?.error">{{status?.error}}</div>

      <div class="row" *ngIf="status?.status === 'done' && status?.newsletterId">
        <a [routerLink]="['/app/newsletters', status?.newsletterId]">Open newsletter</a>
        <a routerLink="/app/newsletters">Go to history</a>
      </div>

      <div class="row" *ngIf="status?.status === 'failed'">
        <a routerLink="/app/create">Back to create</a>
      </div>
    </div>
  `,
  styles: [`
    .card { border:1px solid #ddd; border-radius: 10px; padding: 14px; max-width: 720px; }
    .row { display:flex; gap: 12px; margin-top: 12px; }
    .error { color:#b00; margin-top: 10px; }
  `]
})
export class JobStatusComponent implements OnDestroy {
  jobId = '';
  status: JobStatusDto | null = null;
  t?: any;

  constructor(private route: ActivatedRoute, private api: ApiService) {
    this.jobId = this.route.snapshot.paramMap.get('jobId')!;
    this.poll();
    this.t = setInterval(() => this.poll(), 2500);
  }

  poll() {
    this.api.getJob(this.jobId).subscribe({
      next: (s) => {
        this.status = s;
        if (s.status === 'done' || s.status === 'failed') {
          clearInterval(this.t);
        }
      }
    });
  }

  ngOnDestroy() {
    clearInterval(this.t);
  }
}
