# trahebtoing

**Traductor de hebreo a inglés (hecho con IA)**

Un traductor web ligero y de código abierto que utiliza el diccionario Strong's Hebrew para traducir texto hebreo al inglés. Muestra una traducción literal y un desglose detallado palabra por palabra.

## ✨ Características

* **Traducción por líneas**: Procesa el texto respetando los saltos de línea originales.
* **Desglose palabra por palabra**: Muestra el número de Strong, transliteración, definición completa y uso en la KJV para cada palabra.
* **Manejo inteligente de afijos**: Detecta automáticamente prefijos comunes (ו, ב, ל, מ, כ, ש, ה) y sufijos pronominales (י, ך, ו, ה, נו, ם, etc.) si la palabra exacta no se encuentra.
* **Copia al portapapeles**: Un botón permite copiar la traducción literal con un solo clic.
* **Carga automática**: Detecta y carga automáticamente el archivo `hebrew_biblical_dict.js` si está presente en la misma carpeta.
* **Interfaz intuitiva**: Diseño oscuro, amigable y adaptado para facilitar la lectura del hebreo.

## 🚀 Cómo usar

1. Clona este repositorio o descarga los archivos.
2. Asegúrate de tener el archivo del diccionario (`hebrew_biblical_dict.js`) en la misma carpeta que el `index.html`.
3. Abre el archivo `index.html` en tu navegador web.
4. Pega tu texto en hebreo en el área de texto (una frase por línea) y pulsa **Traducir ▸**.

### Estructura de archivos esperada

```text
trahebtoing/
├── index.html
├── style.css
├── script.js
├── hebrew_biblical_dict.js  <-- (Tu archivo de diccionario)
└── README.md
```

## 🤖 Créditos y Atribución

Este proyecto fue **creado completamente con la ayuda de Inteligencia Artificial**, utilizando el modelo **DeepSeek**.

## 📄 Licencia

Este proyecto es de **Dominio Público** (Public Domain).

Puedes copiar, modificar, distribuir y usar este software para cualquier propósito, comercial o no comercial, sin pedir permiso y sin necesidad de dar crédito (aunque se agradece). Se libera bajo la licencia [Unlicense](https://unlicense.org/) o [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).
