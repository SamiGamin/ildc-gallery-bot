# 📸 ILDC Gallery Bot

Bot de Discord que detecta capturas de pantalla en `#capturas` y las sube automaticamente a la galeria web del convoy.

## ✨ Funciones

- 📸 Detecta imagenes en `#capturas` automaticamente
- 📤 Las sube a GitHub → la web se actualiza sola
- 🟢 Funciona 24/7 en la nube (Railway gratis)
- `/galeria ver` — Ver cuantas imagenes hay
- `/galeria limpiar` — Borrar todas las imagenes

## 🚀 Desplegar en Railway (Gratis)

### 1. Crear el Bot en Discord

1. Ve a [discord.com/developers/applications](https://discord.com/developers/applications)
2. **New Application** → nombre: **ILDC Gallery**
3. **Bot** → Reset Token → copia el token
4. Activa **MESSAGE CONTENT INTENT**
5. **OAuth2 → URL Generator**: scopes `bot` + `applications.commands`, permisos: Send Messages, Read Message History, Add Reactions
6. Invita el bot a tu servidor

### 2. Crear Token de GitHub

1. Ve a [github.com/settings/tokens](https://github.com/settings/tokens)
2. **Generate new token (classic)**
3. Nombre: `ildc-gallery`
4. Permisos: marca **repo** (acceso completo a repos)
5. Copia el token

### 3. Desplegar en Railway

1. Sube este proyecto a GitHub (nuevo repo)
2. Ve a [railway.app](https://railway.app) → inicia sesion con GitHub
3. **New Project** → **Deploy from GitHub Repo** → selecciona el repo
4. Ve a **Variables** y agrega:

| Variable | Valor |
|---|---|
| `DISCORD_TOKEN` | Token del bot de Discord |
| `GITHUB_TOKEN` | Token de GitHub |
| `GITHUB_REPO` | `SamiGamin/ildc-website` |
| `CAPTURES_CHANNEL_ID` | ID del canal #capturas |

1. Railway desplegara automaticamente. ¡Listo!

## 📁 Estructura

```
ildc-gallery-bot/
├── bot.js          # Codigo del bot
├── package.json    # Dependencias
└── README.md       # Este archivo
```

## ⚠️ Notas

- El bot necesita permisos de **Add Reactions** para confirmar con 📸
- El GitHub Token debe tener acceso **repo** para poder escribir gallery.json
- Maximo 50 imagenes en la galeria (las nuevas reemplazan las viejas)
