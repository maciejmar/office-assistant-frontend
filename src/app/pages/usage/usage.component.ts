import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, UsageAdminUserDto, UsageHistoryItemDto } from '../../core/api.service';

@Component({
  standalone: true,
  imports: [CommonModule],
  template: `
    <h1>Koszty AI</h1>
    <p class="muted">Koszty zapytan do LLM w rozbiciu na uzytkownikow.</p>

    <div *ngIf="loading" class="muted">Ladowanie...</div>
    <div *ngIf="error" class="error-msg">{{ error }}</div>

    <ng-container *ngIf="!loading">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Wszyscy uzytkownicy - laczny koszt</div>
          <div class="stat-value">\${{ totalCost | number:'1.4-6' }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Liczba zapytan</div>
          <div class="stat-value">{{ totalCalls }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Uzytkownikow</div>
          <div class="stat-value">{{ users.length }}</div>
        </div>
      </div>

      <section class="panel">
        <h2>Koszty per uzytkownik</h2>
        <table class="usage-table" *ngIf="users.length; else noUsers">
          <thead>
            <tr>
              <th>Email</th>
              <th>Liczba zapytan</th>
              <th>Koszt (USD)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <ng-container *ngFor="let u of users">
              <tr class="user-row" (click)="toggleUser(u)">
                <td>{{ u.email }}</td>
                <td class="mono">{{ u.total_calls }}</td>
                <td class="mono">\${{ u.total_cost_usd | number:'1.4-6' }}</td>
                <td class="mono">{{ selectedUserId === u.user_id ? '▲' : '▼' }}</td>
              </tr>
              <tr *ngIf="selectedUserId === u.user_id">
                <td colspan="4">
                  <div *ngIf="historyLoading" class="muted">Ladowanie historii...</div>
                  <table class="usage-table inner" *ngIf="!historyLoading && history.length; else noHistory">
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Operacja</th>
                        <th>Model</th>
                        <th>Tokeny we/wy</th>
                        <th>Koszt (USD)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let row of history">
                        <td class="mono">{{ row.created_at | date:'dd.MM.yyyy HH:mm' }}</td>
                        <td>{{ row.operation }}</td>
                        <td class="mono">{{ row.model }}</td>
                        <td class="mono">{{ row.input_tokens }}&nbsp;/&nbsp;{{ row.output_tokens }}</td>
                        <td class="mono">\${{ row.cost_usd | number:'1.4-6' }}</td>
                      </tr>
                    </tbody>
                  </table>
                  <ng-template #noHistory>
                    <p class="muted" *ngIf="!historyLoading">Brak zapytan dla tego uzytkownika.</p>
                  </ng-template>
                </td>
              </tr>
            </ng-container>
          </tbody>
        </table>
        <ng-template #noUsers><p class="muted">Brak danych.</p></ng-template>
      </section>
    </ng-container>
  `,
  styles: [`
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      margin: 1rem 0 1.5rem;
    }
    .stat-card {
      background: var(--surface-2, #1e1e2e);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px;
      padding: 1.2rem 1.5rem;
    }
    .stat-label { font-size: 0.75rem; color: rgba(166,176,212,0.7); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.4rem; }
    .stat-value { font-size: 1.6rem; font-weight: 600; color: #a855f7; }
    .usage-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    .usage-table th, .usage-table td { padding: 0.5rem 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.06); text-align: left; }
    .usage-table th { color: rgba(166,176,212,0.7); font-weight: 500; }
    .usage-table.inner { margin: 0.5rem 0 0.75rem; background: rgba(255,255,255,0.02); border-radius: 6px; }
    .user-row { cursor: pointer; }
    .user-row:hover { background: rgba(255,255,255,0.04); }
    .mono { font-family: monospace; }
    .error-msg { color: #f87171; padding: 0.5rem 0; }
    .muted { color: rgba(166,176,212,0.7); }
    @media (max-width: 600px) { .stats-grid { grid-template-columns: 1fr; } }
  `],
})
export class UsageComponent implements OnInit {
  users: UsageAdminUserDto[] = [];
  history: UsageHistoryItemDto[] = [];
  loading = true;
  historyLoading = false;
  error = '';
  selectedUserId: number | null = null;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.getAdminUsersUsage().subscribe({
      next: (users) => { this.users = users; this.loading = false; },
      error: (e) => { this.error = e?.error?.detail ?? 'Blad ladowania danych'; this.loading = false; },
    });
  }

  toggleUser(u: UsageAdminUserDto) {
    if (this.selectedUserId === u.user_id) {
      this.selectedUserId = null;
      this.history = [];
      return;
    }
    this.selectedUserId = u.user_id;
    this.history = [];
    this.historyLoading = true;
    this.api.getAdminUserHistory(u.user_id).subscribe({
      next: (h) => { this.history = h; this.historyLoading = false; },
      error: () => { this.historyLoading = false; },
    });
  }

  get totalCost(): number {
    return this.users.reduce((sum, u) => sum + u.total_cost_usd, 0);
  }

  get totalCalls(): number {
    return this.users.reduce((sum, u) => sum + u.total_calls, 0);
  }
}
