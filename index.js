const { Client, GatewayIntentBits, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, REST, Routes } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// عند تشغيل البوت وتسجيل الأمر
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    const commands = [
        new SlashCommandBuilder()
            .setName('maintenance')
            .setDescription('وضع الصيانة: إخفاء أو إظهار جميع القنوات للأعضاء')
            .addStringOption(option =>
                option.setName('action')
                    .setDescription('اختر الحالة')
                    .setRequired(true)
                    .addChoices(
                        { name: 'تشغيل (إخفاء القنوات)', value: 'on' },
                        { name: 'إيقاف (إعادة القنوات)', value: 'off' }
                    )
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
});

// تنفيذ الأمر عند استخدامه
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'maintenance') {
        await interaction.deferReply({ ephemeral: true });

        const action = interaction.options.getString('action');
        const guild = interaction.guild;
        const everyoneRole = guild.roles.everyone;

        try {
            const channels = await guild.channels.fetch();
            let updatedCount = 0;

            for (const [id, channel] of channels) {
                try {
                    await channel.permissionOverwrites.edit(everyoneRole, {
                        ViewChannel: action === 'on' ? false : null
                    });
                    updatedCount++;
                } catch (err) {
                    console.error(`فشل تعديل صلاحيات القناة ${channel.name}:`, err);
                }
            }

            const embed = new EmbedBuilder()
                .setColor(action === 'on' ? '#FF0000' : '#00FF00')
                .setTitle(action === 'on' ? '🛠️ تم تفعيل وضع الصيانة' : '✅ تم إيقاف وضع الصيانة')
                .setDescription(
                    action === 'on'
                        ? `تم إخفاء القنوات بنجاح عن الأعضاء في **${updatedCount}** قناة.`
                        : `تمت إعادة إظهار القنوات للأعضاء في **${updatedCount}** قناة.`
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: 'حدث خطأ أثناء تطبيق وضع الصيانة!' });
        }
    }
});

// تشغيل البوت باستخدام التوكن المخفي في ريندر
client.login(process.env.TOKEN);
