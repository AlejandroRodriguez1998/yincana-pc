import { Routes } from '@angular/router';
import { guestGuard, landingGuard, matchRole, roleGuard } from './core/guards/auth.guards';

export const routes: Routes = [
  {
    // Página de inicio pública; si ya hay sesión, el guard lleva a la zona del usuario.
    path: '',
    pathMatch: 'full',
    canActivate: [landingGuard],
    title: 'Yincana PC',
    loadComponent: () => import('./features/landing/landing.page').then((m) => m.LandingPage),
  },
  {
    // Alta de jueces pendiente de aprobación. Sin enlaces: la URL se comparte a mano.
    path: 'alta-jueces',
    canActivate: [guestGuard],
    title: 'Alta de jueces · Yincana PC',
    loadComponent: () =>
      import('./features/auth/judge-signup/judge-signup.page').then((m) => m.JudgeSignupPage),
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Entrar · Yincana PC',
    loadComponent: () => import('./features/auth/login/login.page').then((m) => m.LoginPage),
  },
  {
    // Zona del juez (/juez/... y /ranking) bajo un mismo contenedor con menú.
    // Si el usuario no es juez, el router sigue con las rutas siguientes
    // y acaba en '**' → inicio de su zona o login.
    path: '',
    canMatch: [matchRole('judge')],
    loadChildren: () => import('./features/judge/judge.routes').then((m) => m.JUDGE_ROUTES),
  },
  {
    path: 'grupo',
    canMatch: [roleGuard('group')],
    loadChildren: () => import('./features/group/group.routes').then((m) => m.GROUP_ROUTES),
  },
  {
    // Simón dice para proyector u ordenador (solo jueces), sin menú.
    path: 'simon',
    canMatch: [roleGuard('judge')],
    title: 'Simón dice · Yincana PC',
    loadComponent: () => import('./features/simon/simon.page').then((m) => m.SimonPage),
  },
  {
    // Pantalla final / ranking de jueces (podio + tabla por prueba). Solo jueces:
    // las reglas de Firestore tampoco dejan a los grupos leer el desglose.
    path: 'resultados',
    canMatch: [roleGuard('judge')],
    title: 'Resultados finales · Yincana PC',
    loadComponent: () =>
      import('./features/final-results/final-results.page').then((m) => m.FinalResultsPage),
  },
  { path: '**', redirectTo: '' },
];
