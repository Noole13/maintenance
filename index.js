const { Client, GatewayIntentBits, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, REST, Routes, ChannelType } = require('discord.js');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
    res.send('Discord Maintenance Bot is online and active!');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Web server is running and listening on port ${PORT}`);
});

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// معرف قناة الصيانة الثابت الذي طلبته
const MAINTENANCE_CHANNEL_ID = '1550318085146288249';

client.once('clientReady', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    const commands = [
        new SlashCommandBuilder()
            .setName('maintenance')
            .setDescription('إدارة وضع الصيانة للسيرفر')
            .addStringOption(option =>
                option.setName('action')
                    .setDescription('اختر الحالة')
                    .setRequired(true)
                    .addChoices(
                        { name: 'تشغيل (إخفاء السيرفر وإشعار الصيانة)', value: 'on' },
                        { name: 'إيقاف (إعادة القنوات وإشعار العودة)', value: 'off' }
                    )
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'maintenance') {
        await interaction.deferReply({ ephemeral: true });
        
        const action = interaction.options.getString('action');
        const guild = interaction.guild;
        const everyoneRole = guild.roles.everyone;

        try {
            const channels = await guild.channels.fetch();
            const targetChannel = channels.get(MAINTENANCE_CHANNEL_ID);

            for (const [id, channel] of channels) {
                if (!channel || channel.type === ChannelType.GuildCategory) continue;

                try {
                    if (action === 'on') {
                        if (channel.id === MAINTENANCE_CHANNEL_ID) {
                            // إبقاء قناة الصيانة مرئية ومغلقة للكتابة
                            await channel.permissionOverwrites.edit(everyoneRole, {
                                ViewChannel: true,
                                SendMessages: false
                            });
                        } else {
                            // إخفاء باقي القنوات
                            await channel.permissionOverwrites.edit(everyoneRole, {
                                ViewChannel: false
                            });
                        }
                    } else {
                        // إرجاع الصلاحيات لطبيعتها عند إيقاف الصيانة
                        await channel.permissionOverwrites.edit(everyoneRole, {
                            ViewChannel: null,
                            SendMessages: null
                        });
                    }
                } catch (err) {
                    console.error(`فشل تعديل صلاحيات القناة ${channel.name}:`, err);
                }
            }

            // إرسال الرسالة المناسبة في قناة الصيانة الثابتة
            if (targetChannel) {
                if (action === 'on') {
                    const maintenanceEmbed = new EmbedBuilder()
                        .setColor('#FFCC00')
                        .setTitle('🛠️ سيرفر [ 3RB ] تحت الصيانة حالياً')
                        .setDescription(
                            '**عزيزي العضو،**\n\n' +
                            'نعمل حالياً على إجراء أعمال صيانة وتحديثات شاملة للسيرفر.\n' +
                            'تم إخفاء القنوات مؤقتاً لضمان استقرار العمل، وستتم إعادتها قريباً.\n\n' +
                            '_شكراً لصبركم وتفهمكم._'
                        )
                        .setTimestamp()
                        .setFooter({ text: '3RB Maintenance System' });

                    await targetChannel.send({ embeds: [maintenanceEmbed] });
                } else {
                    const backEmbed = new EmbedBuilder()
                        .setColor('#00FF00')
                        .setTitle('✅ انتهت أعمال الصيانة في سيرفر [ 3RB ]')
                        .setDescription(
                            '**يسعدنا إعلامكم أنه تم الانتهاء من الصيانة بنجاح!** 🎉\n\n' +
                            'تمت إعادة جميع القنوات والخدمات للعمل بشكل طبيعي.\n' +
                            'نتمنى لكم وقتاً ممتعاً في السيرفر.'
                        )
                        .setTimestamp()
                        .setFooter({ text: '3RB Maintenance System' });

                    await targetChannel.send({ embeds: [backEmbed] });
                }
            }

            const replyEmbed = new EmbedBuilder()
                .setColor(action === 'on' ? '#FF0000' : '#00FF00')
                .setTitle(action === 'on' ? '🛠️ تم تفعيل وضع الصيانة بنجاح' : '✅ تم إيقاف وضع الصيانة')
                .setDescription(action === 'on' ? 'تم إخفاء القنوات وإرسال إشعار الصيانة تلقائياً.' : 'تمت إعادة القنوات وإرسال إشعار العودة تلقائياً.')
                .setTimestamp();

            await interaction.editReply({ embeds: [replyEmbed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: 'حدث خطأ أثناء تنفيذ الأمر! تأكد من صلاحيات البوت وID القناة.' });
        }
    }
});

client.login(process.env.TOKEN);
