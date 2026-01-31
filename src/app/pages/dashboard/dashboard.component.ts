import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/api.service';
import { forkJoin } from 'rxjs';

@Component({
  standalone: true,
  imports: [CommonModule],
  template: `
    <h1>Dashboard</h1>
    <div class="cards">
      <div class="card">
        <div class="label">Subscribers</div>
        <div class="value">{{subsCount}}</div>
      </div>
      <div class="card">
        <div class="label">Files</div>
        <div class="value">{{filesCount}}</div>
      </div>
      <div class="card">
        <div class="label">Newsletters</div>
        <div class="value">{{newsCount}}</div>
      </div>
    </div>
  `,
  styles: [`
    .cards { display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; max-width: 900px; }
    .card { border:1px solid #ddd; border-radius: 10px; padding: 14px; }
    .label { color:#555; }
    .value { font-size: 28px; font-weight: 700; margin-top: 6px; }
  `]
})
export class DashboardComponent {
  subsCount = 0;
  filesCount = 0;
  newsCount = 0;

  constructor(private api: ApiService) {
    forkJoin({
      subs: this.api.listSubscribers(),
      files: this.api.listFiles(),
      news: this.api.listNewsletters(),
    }).subscribe(({ subs, files, news }) => {
      this.subsCount = subs.length;
      this.filesCount = files.length;
      this.newsCount = news.length;
    });
  }
}
