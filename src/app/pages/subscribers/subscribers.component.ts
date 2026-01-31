import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { ApiService, SubscriberDto } from '../../core/api.service';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
  <h1>Subscribers</h1>

  <div class="row">
    <input [formControl]="email" placeholder="email@example.com" />
    <button (click)="add()" [disabled]="email.invalid || loading">Add</button>
  </div>

  <div class="row">
    <textarea [formControl]="bulk" rows="4" placeholder="Wklej maile (jeden na linię)"></textarea>
    <button (click)="import()" [disabled]="loading">Import</button>
  </div>

  <div class="error" *ngIf="error">{{error}}</div>

  <table class="table" *ngIf="subs.length">
    <thead><tr><th>Email</th><th>Status</th><th></th></tr></thead>
    <tbody>
      <tr *ngFor="let s of subs">
        <td>{{s.email}}</td>
        <td>{{s.status || 'active'}}</td>
        <td><button class="danger" (click)="del(s)">Delete</button></td>
      </tr>
    </tbody>
  </table>

  <div *ngIf="!subs.length && !loading">No subscribers yet.</div>
  `,
  styles: [`
    .row { display:flex; gap: 10px; align-items:flex-start; margin: 12px 0; max-width: 720px; }
    input { flex:1; padding: 10px; }
    textarea { flex:1; padding: 10px; }
    button { padding: 10px 14px; }
    .danger { color:#b00; }
    .error { color:#b00; margin: 10px 0; }
    .table { width: 100%; max-width: 900px; border-collapse: collapse; margin-top: 14px; }
    th, td { border-bottom: 1px solid #eee; padding: 10px; text-align:left; }
  `]
})
export class SubscribersComponent {
  subs: SubscriberDto[] = [];
  loading = false;
  error = '';

  email = new FormControl('', [Validators.required, Validators.email]);
  bulk = new FormControl('');

  constructor(private api: ApiService) {
    this.reload();
  }

  reload() {
    this.loading = true;
    this.api.listSubscribers().subscribe({
      next: (s) => { this.subs = s; },
      error: (e) => { this.error = e?.error?.message || 'Failed to load subscribers'; },
      complete: () => { this.loading = false; }
    });
  }

  add() {
    this.error = '';
    this.loading = true;
    this.api.addSubscriber(this.email.value!).subscribe({
      next: () => { this.email.setValue(''); this.reload(); },
      error: (e) => { this.error = e?.error?.message || 'Add failed'; this.loading = false; }
    });
  }

  import() {
    this.error = '';
    const raw = (this.bulk.value || '').trim();
    const emails = raw
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);

    if (!emails.length) return;

    this.loading = true;
    this.api.importSubscribers(emails).subscribe({
      next: () => { this.bulk.setValue(''); this.reload(); },
      error: (e) => { this.error = e?.error?.message || 'Import failed'; this.loading = false; }
    });
  }

  del(s: SubscriberDto) {
    if (!confirm(`Delete subscriber ${s.email}?`)) return;
    this.loading = true;
    this.api.deleteSubscriber(s.id).subscribe({
      next: () => this.reload(),
      error: (e) => { this.error = e?.error?.message || 'Delete failed'; this.loading = false; }
    });
  }
}
