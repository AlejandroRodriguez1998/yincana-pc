import { Routes } from '@angular/router';
import { JudgeShell } from './judge-shell';

/**
 * Zona del juez: /juez/... y /ranking comparten el mismo JudgeShell (menú y
 * listeners), así que moverse entre ellas no vuelve a leer datos.
 */
export const JUDGE_ROUTES: Routes = [
  {
    path: '',
    component: JudgeShell,
    children: [
      {
        // Podio + tabla completa dentro del panel (con menú). La versión sin menú
        // para proyector es /resultados.
        path: 'ranking',
        title: 'Ranking · Yincana PC',
        data: { mode: 'embedded' },
        loadComponent: () => import('../final-results/final-results').then((m) => m.FinalResults),
      },
      {
        path: 'juez',
        children: [
          {
            path: '',
            title: 'Panel del juez · Yincana PC',
            loadComponent: () =>
              import('./dashboard/dashboard.page').then((m) => m.DashboardPage),
          },
          {
            path: 'puntuar',
            title: 'Registrar tiempo · Yincana PC',
            loadComponent: () => import('./scoring/scoring.page').then((m) => m.ScoringPage),
          },
          {
            path: 'grupos',
            title: 'Grupos · Yincana PC',
            loadComponent: () => import('./groups/groups.page').then((m) => m.GroupsPage),
          },
          {
            path: 'grupos/:groupId',
            title: 'Grupo · Yincana PC',
            loadComponent: () =>
              import('./groups/group-detail.page').then((m) => m.GroupDetailPage),
          },
          {
            path: 'pruebas',
            title: 'Pruebas · Yincana PC',
            loadComponent: () => import('./tests/tests.page').then((m) => m.TestsPage),
          },
          {
            path: 'historial',
            title: 'Historial · Yincana PC',
            loadComponent: () => import('./history/history.page').then((m) => m.HistoryPage),
          },
          {
            path: 'jueces',
            title: 'Jueces · Yincana PC',
            loadComponent: () => import('./judges/judges.page').then((m) => m.JudgesPage),
          },
        ],
      },
    ],
  },
];
