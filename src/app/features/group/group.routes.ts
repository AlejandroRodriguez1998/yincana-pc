import { Routes } from '@angular/router';
import { GroupShell } from './group-shell';

export const GROUP_ROUTES: Routes = [
  {
    path: '',
    component: GroupShell,
    children: [
      {
        path: '',
        title: 'Mi grupo · Yincana PC',
        loadComponent: () =>
          import('./dashboard/group-dashboard.page').then((m) => m.GroupDashboardPage),
      },
    ],
  },
];
