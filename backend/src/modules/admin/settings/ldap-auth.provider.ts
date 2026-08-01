import { Injectable, Logger } from '@nestjs/common';
import { Client } from 'ldapts';
import { AuthSettingsService } from './auth-settings.service';

export interface LdapTestResult {
  success: boolean;
  message: string;
}

/**
 * RFC 4515 filter-value escaping. ldapts only exposes `escapeFilter` as a tagged-template
 * literal (`escapeFilter\`(uid=${value})\``), which doesn't fit substituting a value into an
 * admin-configured filter string at runtime — this does the same character-level escaping by hand.
 */
function escapeLdapFilterValue(value: string): string {
  return value.replace(/[\\*()\0]/g, (char) => `\\${char.charCodeAt(0).toString(16).padStart(2, '0')}`);
}

/**
 * Deliberately does NOT implement the generic AuthProvider interface (see auth module): that
 * interface's `id` field is meant to be a real users.id, which only exists after DB
 * provisioning — a concern that belongs in AuthService.loginWithLdap, not in this LDAP client
 * wrapper. This only ever verifies against the directory and hands back what it found there.
 * Lives in AdminModule (alongside AuthSettingsService, its one real dependency) rather than
 * AuthModule so AdminController's test-connection endpoint can use it without a circular
 * module import — AuthModule imports AdminModule, not the other way around.
 */
@Injectable()
export class LdapAuthProvider {
  private readonly logger = new Logger(LdapAuthProvider.name);

  constructor(private readonly authSettings: AuthSettingsService) {}

  /** Search-then-bind: verifies credentials against the directory, returns the resolved username or null. */
  async verifyCredentials(username: string, password: string): Promise<string | null> {
    const config = await this.authSettings.getLdapConfigWithSecret();
    if (!config.enabled) return null;

    const found = await this.findEntry(config, username);
    if (!found) return null;

    // A fresh connection for the credential check — rebinding the same connection is unreliable
    // across directory server implementations.
    const userClient = this.buildClient(config);
    try {
      await userClient.bind(found.dn, password);
    } catch {
      return null;
    } finally {
      await userClient.unbind().catch(() => undefined);
    }

    return found.username;
  }

  /** Admin diagnostic — never throws, always resolves so the settings UI can show a readable result. */
  async testConnection(testUsername?: string, testPassword?: string): Promise<LdapTestResult> {
    const config = await this.authSettings.getLdapConfigWithSecret();
    if (!config.enabled) return { success: false, message: 'La connexion LDAP est désactivée.' };
    if (!config.url || !config.bindDn || !config.baseDn || !config.searchFilter) {
      return { success: false, message: 'Configuration incomplète : URL, Bind DN, Base DN et filtre de recherche sont obligatoires.' };
    }

    try {
      const client = this.buildClient(config);
      try {
        await client.bind(config.bindDn, config.bindPassword ?? undefined);
      } finally {
        await client.unbind().catch(() => undefined);
      }

      if (!testUsername) return { success: true, message: 'Connexion au compte de service réussie.' };

      const found = await this.findEntry(config, testUsername);
      if (!found) return { success: false, message: `Utilisateur "${testUsername}" introuvable dans l'annuaire.` };
      if (!testPassword) return { success: true, message: `Utilisateur "${testUsername}" trouvé (DN : ${found.dn}). Aucun mot de passe fourni, authentification non testée.` };

      const userClient = this.buildClient(config);
      try {
        await userClient.bind(found.dn, testPassword);
      } catch {
        return { success: false, message: `Mot de passe incorrect pour "${testUsername}".` };
      } finally {
        await userClient.unbind().catch(() => undefined);
      }
      return { success: true, message: `Connexion et authentification réussies pour "${testUsername}".` };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn(`LDAP test failed: ${detail}`);
      return { success: false, message: `Échec de la connexion : ${detail}` };
    }
  }

  private async findEntry(
    config: Awaited<ReturnType<AuthSettingsService['getLdapConfigWithSecret']>>,
    username: string,
  ): Promise<{ dn: string; username: string } | null> {
    const client = this.buildClient(config);
    try {
      await client.bind(config.bindDn, config.bindPassword ?? undefined);

      const filter = config.searchFilter.replace('{{username}}', escapeLdapFilterValue(username));
      const { searchEntries } = await client.search(config.baseDn, {
        scope: 'sub',
        filter,
        sizeLimit: 1,
        attributes: [config.usernameAttribute],
      });

      const entry = searchEntries[0];
      if (!entry) return null;

      const attributeValue = entry[config.usernameAttribute];
      const resolvedUsername = Array.isArray(attributeValue) ? String(attributeValue[0]) : String(attributeValue ?? username);
      return { dn: String(entry.dn), username: resolvedUsername.trim().toLowerCase() };
    } finally {
      await client.unbind().catch(() => undefined);
    }
  }

  private buildClient(config: { url: string; tlsRejectUnauthorized: boolean; connectTimeoutMs: number | null; timeoutMs: number | null }): Client {
    return new Client({
      url: config.url,
      connectTimeout: config.connectTimeoutMs ?? undefined,
      timeout: config.timeoutMs ?? undefined,
      // tlsOptions only takes effect for ldaps:// URLs — passing it for a plain ldap:// connection has no effect either way, but this stays explicit about intent.
      tlsOptions: config.url.startsWith('ldaps://') ? { rejectUnauthorized: config.tlsRejectUnauthorized } : undefined,
    });
  }
}
