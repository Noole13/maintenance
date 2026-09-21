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

const MAINTENANCE_CHANNEL_ID = '1550318085146288249';
const SERVER_LOGO_URL = 'https://raw.githubusercontent.com/Noole13/maintenance/main/Gemini.png';

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
                        { name: 'تشغيل الصيانة (إخفاء القنوات وإبقاء التذاكر والصيانة)', value: 'on' },
                        { name: 'إيقاف الصيانة (إعادة إظهار القنوات والخدمات)', value: 'off' }
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

                // 1. استثناء قناة أو قسم الصيانة ليظل ظاهراً
                if (channel.id === MAINTENANCE_CHANNEL_ID) {
                    try {
                        if (action === 'on') {
                            await channel.permissionOverwrites.edit(everyoneRole, {
                                ViewChannel: true,
                                SendMessages: false
                            });
                        } else {
                            await channel.permissionOverwrites.edit(everyoneRole, {
                                ViewChannel: null,
                                SendMessages: null
                            });
                        }
                    } catch (err) {
                        console.error(`فشل تعديل قناة الصيانة:`, err);
                    }
                    continue;
                }

                // 2. استثناء قسم التذاكر (Tickets) لتظل ظاهرة ومتاحة
                const parentCategory = channel.parent;
                const isTicket = (parentCategory && (parentCategory.name.toLowerCase().includes('ticket') || parentCategory.name.includes('تذكرة') || parentCategory.name.includes('تذاكر'))) ||
                                 channel.name.toLowerCase().includes('ticket') || channel.name.includes('تذكرة');
                
                if (isTicket) {
                    try {
                        if (action === 'on') {
                            // التذاكر تظل مرئية ومتاحة للكتابة لكي يتمكن الأعضاء من التواصل أثناء الصيانة
                            await channel.permissionOverwrites.edit(everyoneRole, {
                                ViewChannel: true,
                                SendMessages: true
                            });
                        } else {
                            await channel.permissionOverwrites.edit(everyoneRole, {
                                ViewChannel: null,
                                SendMessages: null
                            });
                        }
                    } catch (err) {
                        console.error(`فشل تعديل قناة التذاكر ${channel.name}:`, err);
                    }
                    continue;
                }

                // 3. استثناء تام لأي قناة تابعة لتصنيف "الإدارة"
                if (parentCategory && (parentCategory.name.includes('الإدارة') || parentCategory.name.includes('ادارة') || parentCategory.name.includes('admin'))) {
                    continue; 
                }

                try {
                    if (action === 'on') {
                        // عند التشغيل: إخفاء القناة تماماً ومنع الكتابة
                        await channel.permissionOverwrites.edit(everyoneRole, {
                            ViewChannel: false,
                            SendMessages: false
                        });
                    } else {
                        // عند الإيقاف: إعادة كل شيء للافتراضي تماماً (فتح الرؤية والكتابة)
                        await channel.permissionOverwrites.edit(everyoneRole, {
                            ViewChannel: null,
                            SendMessages: null
                        });
                    }
                } catch (err) {
                    console.error(`فشل تعديل صلاحيات القناة ${channel.name}:`, err);
                }
            }

            // إرسال رسائل الإيمبد في قناة الصيانة
            if (targetChannel) {
                if (action === 'on') {
                    const maintenanceEmbed = new EmbedBuilder()
                        .setColor('#FFCC00')
                        .setTitle('🛠️ سيرفر [ 3RB ] تحت الصيانة حالياً')
                        .setDescription(
                            '**عزيزي العضو،**\n\n' +
                            'نعمل حالياً على إجراء أعمال صيانة وتحديثات شاملة للسيرفر لتقديم أفضل تجربة.\n' +
                            'تم إخفاء القنوات العامة مؤقتاً، وتبقى تذاكر الدعم الفني وقناة الصيانة متاحة لكم.\n\n' +
                            '_شكراً لصبركم وتفهمكم._'
                        )
                        .setThumbnail(SERVER_LOGO_URL)
                        .setImage(SERVER_LOGO_URL)
                        .setTimestamp()
                        .setFooter({ text: '3RB Maintenance System', iconURL: SERVER_LOGO_URL });

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
                        .setThumbnail(SERVER_LOGO_URL)
                        .setImage(SERVER_LOGO_URL)
                        .setTimestamp()
                        .setFooter({ text: '3RB Maintenance System', iconURL: SERVER_LOGO_URL });

                    await targetChannel.send({ embeds: [backEmbed] });
                }
            }

            const replyEmbed = new EmbedBuilder()
                .setColor(action === 'on' ? '#FF0000' : '#00FF00')
                .setTitle(action === 'on' ? '🛠️ تم تفعيل وضع الصيانة بنجاح' : '✅ تم إيقاف وضع الصيانة')
                .setDescription(action === 'on' ? 'تم إخفاء القنوات العامة وإبقاء تذاكر الدعم وقناة الصيانة فقط.' : 'تمت إعادة إظهار جميع القنوات العامة بنجاح.')
                .setTimestamp();

            await interaction.editReply({ embeds: [replyEmbed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: 'حدث خطأ أثناء تنفيذ الأمر! تأكد من صلاحيات البوت وID القناة.' });
        }
    }
});

client.login(process.env.TOKEN);
