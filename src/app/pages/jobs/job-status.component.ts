import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService, JobStatusDto } from '../../core/api.service';

@Component({
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="wrap">
      <div class="doc-scene">

        <!-- dokument -->
        <div class="doc" [class.flooded]="status?.status === 'failed'">
          <div class="doc-header"></div>
          <div class="lines">
            <div class="line" style="width:82%"></div>
            <div class="line" style="width:95%"></div>
            <div class="line" style="width:67%"></div>
            <div class="line" style="width:88%"></div>
            <div class="line" style="width:74%"></div>
            <div class="line" style="width:91%"></div>
            <div class="line short" style="width:45%"></div>
          </div>
          <div class="flood-overlay" *ngIf="status?.status === 'failed'"></div>
        </div>

        <!-- ikona pióra pisząca -->
        <div class="pen" *ngIf="!status || status.status === 'queued' || status.status === 'running'">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
        </div>

      </div>

      <!-- komunikat roboczy -->
      <div class="info" *ngIf="!status || status.status === 'queued' || status.status === 'running'">
        <div class="label">{{ statusLabel }}</div>
        <div class="elapsed">{{ elapsed }}</div>
      </div>

      <!-- sukces -->
      <div class="info" *ngIf="status?.status === 'done'">
        <div class="label ok">Newsletter gotowy — przekierowuję…</div>
      </div>

      <!-- błąd (po zalaniu) -->
      <div class="error-box" *ngIf="errorVisible">
        <div class="error-title">Generowanie nie powiodło się</div>
        <div class="error-msg">{{ status?.error || 'Nieznany błąd' }}</div>
        <button (click)="acknowledge()">Rozumiem — wróć do tworzenia</button>
      </div>
    </div>
  `,
  styles: [`
    .wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 48px 24px;
      gap: 32px;
    }

    /* --- scena z dokumentem --- */
    .doc-scene {
      position: relative;
      width: 160px;
      height: 200px;
    }

    .doc {
      width: 160px;
      height: 200px;
      background: var(--surface, #fff);
      border: 2px solid var(--border, #e5e7eb);
      border-radius: 10px;
      padding: 22px 18px 18px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      position: relative;
      overflow: hidden;
      box-shadow: 0 0 0 0 rgba(99,102,241,0.3);
      animation: pulse-glow 2.2s ease-in-out infinite;
    }

    @keyframes pulse-glow {
      0%, 100% { box-shadow: 0 4px 18px rgba(99,102,241,0.12); }
      50%       { box-shadow: 0 4px 40px rgba(99,102,241,0.42); }
    }

    .doc-header {
      height: 12px;
      border-radius: 4px;
      background: var(--primary, #6366f1);
      opacity: 0.7;
      width: 55%;
    }

    .lines { display: flex; flex-direction: column; gap: 9px; margin-top: 4px; }

    .line {
      height: 7px;
      border-radius: 4px;
      background: var(--border, #e5e7eb);
      transform-origin: left;
      animation: write 1.9s ease-in-out infinite;
    }
    .line:nth-child(1) { animation-delay: 0.0s; }
    .line:nth-child(2) { animation-delay: 0.2s; }
    .line:nth-child(3) { animation-delay: 0.4s; }
    .line:nth-child(4) { animation-delay: 0.6s; }
    .line:nth-child(5) { animation-delay: 0.8s; }
    .line:nth-child(6) { animation-delay: 1.0s; }
    .line:nth-child(7) { animation-delay: 1.2s; }

    @keyframes write {
      0%, 100% { opacity: 0.25; transform: scaleX(0.5); }
      50%       { opacity: 1;    transform: scaleX(1);   }
    }

    /* ikona pióra */
    .pen {
      position: absolute;
      bottom: -10px;
      right: -14px;
      color: var(--primary, #6366f1);
      animation: pen-bounce 1.9s ease-in-out infinite;
    }
    @keyframes pen-bounce {
      0%, 100% { transform: translate(0, 0) rotate(-10deg); }
      50%       { transform: translate(-4px, -6px) rotate(-10deg); }
    }

    /* --- zalanie błędem --- */
    .flood-overlay {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      height: 0;
      background: rgba(220, 38, 38, 0.82);
      animation: flood 1.6s cubic-bezier(.4,0,.2,1) forwards;
    }
    @keyframes flood {
      to { height: 100%; }
    }

    .doc.flooded {
      animation: none;
      border-color: #dc2626;
    }

    /* --- etykieta statusu --- */
    .info { text-align: center; }
    .label { font-size: 1rem; font-weight: 600; }
    .label.ok { color: #065f46; }
    .elapsed { margin-top: 6px; color: var(--muted, #888); font-size: 0.85rem; }

    /* --- panel błędu --- */
    .error-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      text-align: center;
      max-width: 420px;
    }
    .error-title { font-size: 1.05rem; font-weight: 700; color: #dc2626; }
    .error-msg { color: var(--muted, #666); font-size: 0.9rem; }
    .error-box button {
      margin-top: 6px;
      padding: 10px 22px;
    }
  `]
})
export class JobStatusComponent implements OnDestroy {
  jobId = '';
  status: JobStatusDto | null = null;
  elapsed = '';
  errorVisible = false;

  private pollTimer?: any;
  private clockTimer?: any;
  private startedAt = Date.now();

  constructor(private route: ActivatedRoute, private api: ApiService, private router: Router) {
    this.jobId = this.route.snapshot.paramMap.get('jobId')!;
    this.poll();
    this.pollTimer = setInterval(() => this.poll(), 2500);
    this.clockTimer = setInterval(() => this.tickClock(), 1000);
  }

  get statusLabel(): string {
    switch (this.status?.status) {
      case 'running': return 'Generowanie newslettera…';
      case 'queued':  return 'Oczekiwanie w kolejce…';
      default:        return 'Uruchamianie…';
    }
  }

  tickClock() {
    const s = Math.floor((Date.now() - this.startedAt) / 1000);
    const m = Math.floor(s / 60);
    this.elapsed = m > 0 ? `${m} min ${s % 60} s` : `${s} s`;
  }

  poll() {
    this.api.getJob(this.jobId).subscribe({
      next: (s) => {
        this.status = s;
        if (s.status === 'done' || s.status === 'failed') {
          clearInterval(this.pollTimer);
          clearInterval(this.clockTimer);
        }
        if (s.status === 'failed') {
          // poczekaj aż animacja zalania dobiegnie końca
          setTimeout(() => { this.errorVisible = true; }, 1700);
        }
        if (s.status === 'done' && s.newsletterId) {
          this.router.navigateByUrl(`/app/newsletters/${s.newsletterId}`);
        }
      }
    });
  }

  acknowledge() {
    this.router.navigateByUrl('/app/create');
  }

  ngOnDestroy() {
    clearInterval(this.pollTimer);
    clearInterval(this.clockTimer);
  }
}
