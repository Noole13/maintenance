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
                        { name: 'تشغيل الصيانة', value: 'on' },
                        { name: 'إيقاف الصيانة', value: 'off' }
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

                // 1. استثناء قناة الصيانة وحدها لتظل ظاهرة
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

                // 2. استثناء تام لأي قناة تابعة لتصنيف "الإدارة"
                const parentCategory = channel.parent;
                if (parentCategory && (parentCategory.name.includes('الإدارة') || parentCategory.name.includes('ادارة') || parentCategory.name.includes('admin'))) {
                    continue; 
                }

                try {
                    if (action === 'on') {
                        // عند التشغيل: إخفاء القناة تماماً عن الجميع
                        await channel.permissionOverwrites.edit(everyoneRole, {
                            ViewChannel: false,
                            SendMessages: false
                        });
                    } else {
                        // عند الإيقاف: إعادة الصلاحيات للوضع الافتراضي
                        await channel.permissionOverwrites.edit(everyoneRole, {
                            ViewChannel: null,
                            SendMessages: null
                        });
                    }
                } catch (err) {
                    console.error(`فشل تعديل صلاحيات القناة ${channel.name}:`, err);
                }
            }

            // إرسال رسائل الإيمبد المحفزة في قناة الصيانة
            if (targetChannel) {
                if (action === 'on') {
                    const maintenanceEmbed = new EmbedBuilder()
                        .setColor('#FFCC00')
                        .setTitle('🛠️ سيرفر [ 3RB ] تحت الصيانة حالياً')
                        .setDescription(
                            '**عزيزي العضو،**\n\n' +
                            'نعمل حالياً على تطوير وتحسين السيرفر لنقدم لكم تجربة استثنائية وفريدة تليق بكم.\n' +
                            'ترقبوا المفاجآت والتحسينات القادمة قريباً جداً!\n\n' +
                            '_شكراً لصبركم ودعمكم المستمر._'
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
                            'نورتوا السيرفر من جديد، ونتمنى لكم أوقاتاً ممتعة مليئة بالحماس والمتعة.'
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
                .setDescription(action === 'on' ? 'تم تفعيل وضع الصيانة وإخفاء القنوات بنجاح.' : 'تمت إعادة فتح السيرفر وعودة الأقسام للعمل.')
                .setTimestamp();

            await interaction.editReply({ embeds: [replyEmbed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: 'حدث خطأ أثناء تنفيذ الأمر! تأكد من صلاحيات البوت وID القناة.' });
        }
    }
});

client.login(process.env.TOKEN);
