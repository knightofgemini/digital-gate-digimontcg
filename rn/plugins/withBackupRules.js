// Regole del backup automatico di Android: le immagini salvate (files/img, fino a ~500 MB) e i prezzi non vanno nel backup
// su Google Drive (oltre 25 MB il backup dell'app fallisce del tutto, collezione compresa). Collezione, preferite e mazzi
// (database di AsyncStorage) restano nel backup.
const { withAndroidManifest, withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const EXCL = '    <exclude domain="file" path="img/" />\n    <exclude domain="file" path="prices.json" />\n';

module.exports = function withBackupRules(config) {
  config = withDangerousMod(config, [
    "android",
    async (c) => {
      const dir = path.join(c.modRequest.platformProjectRoot, "app/src/main/res/xml");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "dg_backup_rules.xml"), '<?xml version="1.0" encoding="utf-8"?>\n<full-backup-content>\n' + EXCL.replace(/^ {4}/gm, "  ") + "</full-backup-content>\n");
      fs.writeFileSync(
        path.join(dir, "dg_data_extraction_rules.xml"),
        '<?xml version="1.0" encoding="utf-8"?>\n<data-extraction-rules>\n  <cloud-backup>\n' + EXCL + "  </cloud-backup>\n  <device-transfer>\n" + EXCL + "  </device-transfer>\n</data-extraction-rules>\n"
      );
      return c;
    },
  ]);
  return withAndroidManifest(config, (c) => {
    const app = c.modResults.manifest.application[0];
    app.$["android:fullBackupContent"] = "@xml/dg_backup_rules";
    app.$["android:dataExtractionRules"] = "@xml/dg_data_extraction_rules";
    return c;
  });
};
