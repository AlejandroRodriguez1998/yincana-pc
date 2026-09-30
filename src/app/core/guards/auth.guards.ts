import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { UserRole } from '../models';

/*
 * Los guards mejoran la navegación, pero NO son la barrera de seguridad:
 * esa la imponen las reglas de Firestore.
 */

function homeFor(router: Router, role: UserRole | undefined): UrlTree {
  if (role === 'judge') return router.parseUrl('/juez');
  if (role === 'group') return router.parseUrl('/grupo');
  return router.parseUrl('/login');
}

/** Requiere un rol concreto; si el rol es otro, redirige a su zona. */
export function roleGuard(role: UserRole): CanMatchFn {
  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const status = await auth.whenResolved();
    if (status !== 'ready') return router.parseUrl('/login');
    const profile = auth.profile();
    return profile?.role === role ? true : homeFor(router, profile?.role);
  };
}

/**
 * Variante que no redirige: si el rol no coincide, el router sigue probando
 * otras rutas. Útil en rutas sin segmento propio (path: '').
 */
export function matchRole(role: UserRole): CanMatchFn {
  return async () => {
    const auth = inject(AuthService);
    const status = await auth.whenResolved();
    return status === 'ready' && auth.profile()?.role === role;
  };
}

/** Para /login: si ya hay sesión con perfil, lleva a la zona del usuario. */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const status = await auth.whenResolved();
  return status === 'ready' ? homeFor(router, auth.profile()?.role) : true;
};

/** Ruta raíz: redirige según el rol. */
export const homeRedirectGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.whenResolved();
  return homeFor(router, auth.profile()?.role);
};
