# Pruebas

Recorren el sitio en Chrome real: escenas, header, carrusel, casos de Fábrica, reclamos del cliente, mails demo, link del mail y modo estático, en 1440×900, 1024×768 y 390×844. No envían ningún mail.

Necesitan Node y Chrome instalados.

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
