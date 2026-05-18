## Descripción

<!-- Qué cambia y por qué -->

## Checklist — desarrollo seguro (FEMSA / control 7)

- [ ] CI en verde: tests, Gitleaks, Semgrep y `npm audit` (crítico+)
- [ ] Sin secretos, tokens ni credenciales en el diff
- [ ] Cambios en auth, permisos o datos sensibles: revisión adicional
- [ ] Dependencias nuevas justificadas; CVEs críticos/altos con ticket y fecha límite (SLA 45 días)
- [ ] Variables de entorno documentadas si aplica (sin valores reales en el PR)

## Evidencia

<!-- Capturas, enlace a issue o N/A -->
