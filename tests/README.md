# Pruebas

Recorren el sitio en Chrome real. Necesitan Node y Chrome instalados, y no envían ningún mail.

## Sitio en modo demostración

Cubren escenas, header, carrusel, casos de Fábrica, vista del cliente, accesos, solicitudes, mails demo, link del mail y modo estático, en 1440×900, 1024×768 y 390×844.

1. Levantá el sitio, desde la raíz del repo:

```bash
python -m http.server 4173
```

2. En otra terminal:

```bash
cd tests
npm install
npm test
```

Variables opcionales:

- `BASE`: otra dirección para probar. Por defecto, `http://localhost:4173/`.
- `TEST_VIDEO`: ruta a un video MP4 o WebM. Sin ella no se comprueba que el video se reproduzca.

## Solicitudes con la base de datos real

Comprueba que una solicitud cargada en un dispositivo llega a otro, y que sin clave no se pueden leer ni cambiar. Usa claves temporales y borra todas las filas que crea. Necesita `DATABASE_URL`, con las tablas creadas (`node scripts/db-init.js`).

```bash
cd tests
npm run test:real
```
