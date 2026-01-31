import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="layout">
      <header class="top">
        <div class="brand">Office Assistant</div>
        <nav>
          <a routerLink="/app/dashboard" routerLinkActive="active">Dashboard</a>
          <a routerLink="/app/subscribers" routerLinkActive="active">Subscribers</a>
          <a routerLink="/app/create" routerLinkActive="active">Create</a>
          <a routerLink="/app/newsletters" routerLinkActive="active">Newsletters</a>
        </nav>
        <button class="logout" (click)="logout()">Logout</button>
      </header>

      <main class="content">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .layout {
      min-height: 100vh;
      padding: 24px;
    }

    .top {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 18px;
      padding: 16px 20px;
      border-radius: var(--radius);
      background:
        linear-gradient(180deg, rgba(21, 27, 44, 0.75), rgba(15, 20, 36, 0.98)),
        var(--grad-main);
      border: 1px solid var(--border);
      box-shadow: var(--shadow);
      backdrop-filter: blur(8px);
      position: sticky;
      top: 16px;
      z-index: 5;
    }

    .brand {
      font-weight: 700;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      font-size: 0.9rem;
      color: var(--muted);
    }

    nav {
      display: flex;
      gap: 14px;
      flex-wrap: wrap;
      align-items: center;
    }

    nav a {
      text-decoration: none;
      padding: 8px 12px;
      border-radius: 999px;
      color: var(--muted);
      border: 1px solid transparent;
      transition: all 160ms ease;
    }

    nav a:hover {
      color: var(--text);
      background: rgba(255, 255, 255, 0.06);
      border-color: var(--border);
    }

    .active {
      color: var(--text);
      background: rgba(94, 228, 195, 0.12);
      border-color: rgba(94, 228, 195, 0.4);
      box-shadow: inset 0 0 0 1px rgba(94, 228, 195, 0.25);
    }

    .logout {
      padding: 10px 14px;
      border-radius: 10px;
      color: var(--text);
      background: linear-gradient(135deg, rgba(255, 107, 107, 0.25), rgba(255, 107, 107, 0.12));
      border: 1px solid rgba(255, 107, 107, 0.45);
      transition: transform 140ms ease, box-shadow 140ms ease;
    }

    .logout:hover {
      transform: translateY(-1px);
      box-shadow: 0 10px 24px rgba(255, 107, 107, 0.2);
    }

    .content {
      margin-top: 22px;
      padding: 22px;
      border-radius: var(--radius);
      background:
        radial-gradient(500px 260px at 5% -20%, rgba(106, 167, 255, 0.15), transparent 60%),
        radial-gradient(420px 220px at 95% -20%, rgba(248, 107, 210, 0.18), transparent 60%),
        rgba(15, 20, 36, 0.9);
      border: 1px solid var(--border);
      box-shadow: var(--shadow);
      min-height: calc(100vh - 140px);
    }

    @media (max-width: 900px) {
      .top {
        grid-template-columns: 1fr;
        gap: 12px;
        position: static;
      }

      nav {
        justify-content: space-between;
      }

      .content {
        padding: 18px;
      }
    }
  `]
})
export class LayoutComponent {
  constructor(private auth: AuthService, private router: Router) {}

  logout() {
    this.auth.logout().subscribe({
      next: () => this.router.navigateByUrl('/login'),
      error: () => this.router.navigateByUrl('/login'),
    });
  }
}
