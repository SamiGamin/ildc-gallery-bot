const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes, PermissionFlagsBits } = require('discord.js');

// ─── Configuración desde variables de entorno ───
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'SamiGamin/ildc-gallery-bot';
const GITHUB_FILE = process.env.GITHUB_FILE || 'gallery.json';
const CAPTURES_CHANNEL_ID = process.env.CAPTURES_CHANNEL_ID || '';
const MAX_IMAGES = 50;

// ─── Validar configuración ───
if (!DISCORD_TOKEN) {
  console.log('❌ ERROR: DISCORD_TOKEN no configurado');
  process.exit(1);
}
if (!GITHUB_TOKEN) {
  console.log('❌ ERROR: GITHUB_TOKEN no configurado');
  console.log('Crea un token en: https://github.com/settings/tokens');
  process.exit(1);
}

// ─── Cliente de Discord ───
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ─── GitHub API: Leer gallery.json ───
async function getGalleryFromGitHub() {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}`, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (res.status === 404) {
      return { images: [], sha: null };
    }

    const data = await res.json();
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    return { images: JSON.parse(content), sha: data.sha };
  } catch (e) {
    console.log('[ERROR] No se pudo leer gallery.json de GitHub:', e.message);
    return { images: [], sha: null };
  }
}

// ─── GitHub API: Subir imagen al repo ───
async function uploadImageToGitHub(imageUrl, filename) {
  try {
    // Descargar imagen de Discord
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    const buffer = await res.arrayBuffer();
    const base64Content = Buffer.from(buffer).toString('base64');

    // Subir al repo
    const filePath = `img/gallery/${filename}`;
    const uploadRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `📸 ${filename}`,
        content: base64Content
      })
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.json();
      throw new Error(err.message);
    }

    // Devolver URL permanente
    return `https://raw.githubusercontent.com/${GITHUB_REPO}/main/${filePath}`;
  } catch (e) {
    console.log(`[ERROR] No se pudo subir imagen: ${e.message}`);
    return null;
  }
}

// ─── GitHub API: Guardar gallery.json ───
async function saveGalleryToGitHub(images, sha) {
  try {
    const content = Buffer.from(JSON.stringify(images, null, 2)).toString('base64');
    const body = {
      message: `📸 Galeria actualizada (${images.length} imagenes)`,
      content: content
    };
    if (sha) body.sha = sha;

    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (res.ok) {
      console.log(`[BOT] gallery.json actualizado en GitHub (${images.length} imagenes)`);
      return true;
    } else {
      const err = await res.json();
      console.log('[ERROR] GitHub API:', err.message);
      return false;
    }
  } catch (e) {
    console.log('[ERROR] No se pudo guardar en GitHub:', e.message);
    return false;
  }
}

const commands = [
  new SlashCommandBuilder()
    .setName('galeria')
    .setDescription('Gestionar la galeria web')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub
      .setName('ver')
      .setDescription('Ver cuantas imagenes hay en la galeria'))
    .addSubcommand(sub => sub
      .setName('lista')
      .setDescription('Ver lista numerada de todas las imagenes'))
    .addSubcommand(sub => sub
      .setName('borrar')
      .setDescription('Borrar una imagen especifica por numero')
      .addIntegerOption(opt => opt
        .setName('numero')
        .setDescription('Numero de la imagen (usa /galeria lista para ver)')
        .setRequired(true)))
    .addSubcommand(sub => sub
      .setName('limpiar')
      .setDescription('Borrar todas las imagenes de la galeria'))
].map(cmd => cmd.toJSON());

// ─── Escuchar imágenes en #capturas ───
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Si hay canal configurado, solo escuchar ese canal
  if (CAPTURES_CHANNEL_ID && message.channel.id !== CAPTURES_CHANNEL_ID) return;

  // Si no hay canal configurado, escuchar cualquier canal llamado "capturas"
  if (!CAPTURES_CHANNEL_ID && !message.channel.name.includes('captura')) return;

  const images = message.attachments.filter(att =>
    att.contentType && att.contentType.startsWith('image/')
  );

  if (images.size === 0) return;

  const author = message.author.username;
  console.log(`[BOT] ${images.size} imagen(es) detectada(s) de ${author}`);

  let successCount = 0;

  // Obtener galería actual de GitHub
  const { images: gallery, sha } = await getGalleryFromGitHub();

  // Procesar cada imagen: descargar + subir al repo
  for (const [, img] of images) {
    const ext = (img.name || 'image.png').split('.').pop() || 'png';
    const safeName = `${Date.now()}_${author}.${ext}`.replace(/[^a-zA-Z0-9._-]/g, '_');

    console.log(`[BOT] Descargando y subiendo: ${img.name} → ${safeName}`);
    const permanentUrl = await uploadImageToGitHub(img.url, safeName);

    if (permanentUrl) {
      gallery.push({
        url: permanentUrl,
        author: author,
        date: new Date().toISOString(),
        width: img.width || 0,
        height: img.height || 0
      });
      successCount++;
      // Pequeña pausa entre uploads para evitar race conditions en GitHub
      if (images.size > 1) await new Promise(r => setTimeout(r, 1000));
    }
  }

  if (successCount === 0) {
    try { await message.react('❌'); } catch (e) {}
    return;
  }

  // Mantener máximo de imágenes
  while (gallery.length > MAX_IMAGES) gallery.shift();

  // Guardar gallery.json actualizado
  const success = await saveGalleryToGitHub(gallery, sha);

  if (success) {
    try { await message.react('📸'); } catch (e) {}
    try {
      await message.reply({
        content: `✅ 📸 ${successCount} imagen${successCount > 1 ? 'es' : ''} guardada${successCount > 1 ? 's' : ''} en la galería web permanentemente! 🌐`,
        allowedMentions: { repliedUser: false }
      });
    } catch (e) {}
    console.log(`[BOT] ✅ ${successCount} imagen(es) de ${author} guardada(s) permanentemente`);
  } else {
    try { await message.react('❌'); } catch (e) {}
  }
});

// ─── Manejar slash commands ───
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'galeria') {
    const sub = interaction.options.getSubcommand();

    if (sub === 'ver') {
      const { images } = await getGalleryFromGitHub();
      const embed = new EmbedBuilder()
        .setTitle('📸 Galeria Web')
        .setColor(0xFF6B35)
        .addFields(
          { name: '🖼️ Imagenes', value: `${images.length}/${MAX_IMAGES}`, inline: true },
          { name: '🌐 Web', value: `[Ver galeria](https://${GITHUB_REPO.split('/')[0].toLowerCase()}.github.io/${GITHUB_REPO.split('/')[1]}/#galeria)`, inline: true }
        )
        .setTimestamp();

      if (images.length > 0) {
        const lastImg = images[images.length - 1];
        embed.setThumbnail(lastImg.url);
        embed.addFields({
          name: '📷 Ultima captura',
          value: `Por **${lastImg.author}** — ${new Date(lastImg.date).toLocaleDateString('es-CO')}`,
          inline: false
        });
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });

    } else if (sub === 'lista') {
      const { images } = await getGalleryFromGitHub();
      if (images.length === 0) {
        await interaction.reply({ content: '📸 La galeria esta vacia.', ephemeral: true });
        return;
      }
      const list = images.map((img, i) => {
        const date = new Date(img.date).toLocaleDateString('es-CO');
        return `\`${i + 1}.\` 📷 **${img.author}** — ${date}`;
      }).join('\n');
      await interaction.reply({ content: `📸 **Imagenes en la galeria (${images.length}):**\n\n${list}\n\nUsa \`/galeria borrar <numero>\` para eliminar una`, ephemeral: true });

    } else if (sub === 'borrar') {
      const num = interaction.options.getInteger('numero');
      const { images, sha } = await getGalleryFromGitHub();
      if (num < 1 || num > images.length) {
        await interaction.reply({ content: `❌ Numero invalido. Hay ${images.length} imagenes. Usa \`/galeria lista\` para ver.`, ephemeral: true });
        return;
      }
      const removed = images.splice(num - 1, 1)[0];
      const success = await saveGalleryToGitHub(images, sha);
      if (success) {
        await interaction.reply({ content: `✅ Imagen #${num} eliminada (de **${removed.author}**)\nQuedan ${images.length} imagenes.`, ephemeral: true });
      } else {
        await interaction.reply({ content: '❌ Error al guardar. Intenta de nuevo.', ephemeral: true });
      }

    } else if (sub === 'limpiar') {
      const { images, sha } = await getGalleryFromGitHub();
      if (images.length === 0) {
        await interaction.reply({ content: '📸 La galeria ya esta vacia.', ephemeral: true });
        return;
      }
      await saveGalleryToGitHub([], sha);
      await interaction.reply({ content: `✅ Galeria limpiada. Se eliminaron ${images.length} imagenes.`, ephemeral: true });
    }
  }
});

// ─── Bot listo ───
client.once('ready', async () => {
  console.log('═══════════════════════════════════════');
  console.log('  📸 ILDC Gallery Bot');
  console.log(`  Bot: ${client.user.tag}`);
  console.log(`  Repo: ${GITHUB_REPO}`);
  console.log(`  Canal: ${CAPTURES_CHANNEL_ID || 'Cualquier #capturas'}`);
  console.log('═══════════════════════════════════════');

  // Registrar slash commands
  try {
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('[BOT] Slash commands registrados.');
  } catch (error) {
    console.log('[ERROR] Commands:', error.message);
  }

  // Actividad del bot
  client.user.setActivity('📸 Esperando capturas', { type: 3 });
});

// ─── Iniciar ───
console.log('[BOT] Conectando...');
client.login(DISCORD_TOKEN);
