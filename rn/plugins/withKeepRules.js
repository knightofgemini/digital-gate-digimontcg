// Regole per il rimpicciolimento del codice dell'APK (R8): il controllo delle carte nuove in sottofondo usa WorkManager
// di Android (expo-background-task), che apre il suo database con un costruttore che R8 toglieva: l'app si chiudeva
// subito all'avvio (12 novembre 2026, prova su emulatore). Qui si tengono le classi di WorkManager e del database.
const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const RULES = `
# Digital Gate: WorkManager (controllo in sottofondo)
-keep class androidx.work.** { *; }
-keep class * extends androidx.room.RoomDatabase { <init>(...); }
-keep class androidx.room.** { *; }
`;

module.exports = function withKeepRules(config) {
  return withDangerousMod(config, [
    "android",
    async (c) => {
      const f = path.join(c.modRequest.platformProjectRoot, "app/proguard-rules.pro");
      const old = fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "";
      if (!old.includes("Digital Gate: WorkManager")) fs.writeFileSync(f, old + RULES);
      return c;
    },
  ]);
};
