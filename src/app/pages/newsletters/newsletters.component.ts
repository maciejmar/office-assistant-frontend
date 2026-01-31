import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, NewsletterDto } from '../../core/api.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <h1>Newsletter history</h1>

    <table class="table" *ngIf="items.length">
      <thead><tr><th>Subject</th><th>Created</th><th></th></tr></thead>
      <tbody>
        <tr *ngFor="let n of items">
          <td>{{n.subject}}</td>
          <td>{{n.created_at}}</td>
          <td><a [routerLink]="['/app/newsletters', n.id]">Open</a></td>
        </tr>
      </tbody>
    </table>

    <div *ngIf="!items.length">No newsletters yet.</div>
  `,
  styles: [`
    .table { width: 100%; max-width: 980px; border-collapse: collapse; margin-top: 14px; }
    th, td { border-bottom: 1px solid #eee; padding: 10px; text-align:left; }
  `]
})
export class NewslettersComponent {
  items: NewsletterDto[] = [];

  constructor(private api: ApiService) {
    this.api.listNewsletters().subscribe(n => this.items = n);
  }
}
