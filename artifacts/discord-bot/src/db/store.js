import fs from 'fs';
import path from 'path';

// This ensures the settings file is created in the same folder as store.js (the db folder)
const filePath = path.join(process.cwd(), 'db', 'guild_settings.json');

/**
 * A simple JSON-based storage for server settings like auto-roles.
 */
class GuildStore {
    constructor() {
        this.data = this.load();
    }

    load() {
        try {
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf-8');
                return JSON.parse(content);
            }
        } catch (err) {
            console.error("Error loading store:", err);
        }
        return {};
    }

    save() {
        try {
            // Ensure the directory exists before saving
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(filePath, JSON.stringify(this.data, null, 4));
        } catch (err) {
            console.error("Error saving store:", err);
        }
    }

    set(guildId, key, value) {
        if (!this.data[guildId]) this.data[guildId] = {};
        this.data[guildId][key] = value;
        this.save();
    }

    get(guildId, key) {
        return this.data[guildId]?.[key] || null;
    }
}

export const guildStore = new GuildStore();