import { Client, GatewayIntentBits, GuildMember } from 'discord.js';

export interface DiscordMemberStatus {
  id: string;
  username: string;
  displayName: string;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  avatarUrl: string | null;
  bot: boolean;
}

export interface DiscordGuildStatus {
  guildId: string;
  guildName: string;
  totalMembers: number;
  onlineMembers: number;
  members: DiscordMemberStatus[];
  lastUpdatedIso: string;
}

let discordClient: Client | null = null;

function getDiscordClient(): Client {
  if (!discordClient) {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) {
      throw new Error('DISCORD_BOT_TOKEN environment variable is required');
    }

    discordClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
      ],
    });

    // Login the client
    discordClient.login(token).catch((error) => {
      console.error('Failed to login to Discord:', error);
      discordClient = null;
      throw error;
    });
  }

  return discordClient;
}

function mapMemberStatus(member: GuildMember): DiscordMemberStatus {
  const presenceStatus = member.presence?.status ?? 'offline';
  // Map 'invisible' status to 'offline' for consistency
  const status = presenceStatus === 'invisible' ? 'offline' : presenceStatus;
  
  return {
    id: member.id,
    username: member.user.username,
    displayName: member.displayName,
    status: status as 'online' | 'idle' | 'dnd' | 'offline',
    avatarUrl: member.user.avatarURL(),
    bot: member.user.bot,
  };
}

export async function fetchDiscordGuildStatus(): Promise<DiscordGuildStatus> {
  const client = getDiscordClient();
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!guildId) {
    throw new Error('DISCORD_GUILD_ID environment variable is required');
  }

  // Wait for client to be ready if needed
  if (!client.isReady()) {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Discord client connection timeout'));
      }, 10000);

      client.once('ready', () => {
        clearTimeout(timeout);
        resolve();
      });

      client.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  const guild = await client.guilds.fetch(guildId);
  
  // Fetch all members with presences
  await guild.members.fetch({ withPresences: true });

  const allMembers = Array.from(guild.members.cache.values());
  const onlineMembers = allMembers.filter(member => 
    member.presence?.status === 'online' || member.presence?.status === 'idle' || member.presence?.status === 'dnd'
  );

  const memberStatuses = allMembers.map(mapMemberStatus);

  return {
    guildId: guild.id,
    guildName: guild.name,
    totalMembers: allMembers.length,
    onlineMembers: onlineMembers.length,
    members: memberStatuses,
    lastUpdatedIso: new Date().toISOString(),
  };
}

export async function cleanupDiscordClient(): Promise<void> {
  if (discordClient) {
    await discordClient.destroy();
    discordClient = null;
  }
}
