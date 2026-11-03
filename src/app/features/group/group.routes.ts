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
      {
        // Prueba "Recupera el archivo". Los QR de las tarjetas apuntan aquí (?s=código).
        path: 'disco/:testId',
        title: 'Recupera el archivo · Yincana PC',
        loadComponent: () => import('./disk/group-disk.page').then((m) => m.GroupDiskPage),
      },
    ],
  },
];
