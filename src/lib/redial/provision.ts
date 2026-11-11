import "server-only";

// Auto-setup files for desk, cordless and Wi-Fi phones. Each phone asks for a
// file named after its MAC address; the file holds one SIP account on
// Redial's Twilio SIP domain. Values are escaped for each format.

export type ProvisionAccount = { mac: string; label: string; username: string; password: string; domain: string };
export type ProvisionFile = { body: string; type: string } | null;

const xmlEsc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const plain = (s: string) => s.replace(/[\r\n]/g, " ");

// Grandstream (WP8xx, GRP, DP): cfg<mac>.xml with P-values for account 1.
function grandstream(a: ProvisionAccount): string {
  const p: Record<string, string> = {
    P271: "1", // account active
    P270: "Redial", // account name
    P47: a.domain, // SIP server
    P35: a.username, // SIP user ID
    P36: a.username, // authenticate ID
    P34: a.password, // authenticate password
    P3: a.label, // display name
    P31: "1", // SIP registration
    P81: "1", // unregister on reboot
    P32: "60", // registration expiration (minutes)
  };
  const lines = Object.entries(p).map(([k, v]) => `    <${k}>${xmlEsc(v)}</${k}>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8" ?>\n<gs_provision version="1">\n  <mac>${a.mac}</mac>\n  <config version="1">\n${lines}\n  </config>\n</gs_provision>\n`;
}

// Yealink: <mac>.cfg key = value pairs for account 1.
function yealink(a: ProvisionAccount): string {
  return [
    "#!version:1.0.0.1",
    "account.1.enable = 1",
    "account.1.label = Redial",
    `account.1.display_name = ${plain(a.label)}`,
    `account.1.auth_name = ${a.username}`,
    `account.1.user_name = ${a.username}`,
    `account.1.password = ${plain(a.password)}`,
    `account.1.sip_server.1.address = ${a.domain}`,
    "account.1.sip_server.1.port = 5060",
    "account.1.sip_server.1.expires = 3600",
    "",
  ].join("\n");
}

// Poly (VVX, Edge): <mac>.cfg is the master file that points at
// <mac>-redial.cfg, which holds registration 1.
function polyMaster(a: ProvisionAccount): string {
  return `<?xml version="1.0" standalone="yes"?>\n<APPLICATION APP_FILE_PATH="" CONFIG_FILES="${a.mac}-redial.cfg" MISC_FILES="" LOG_FILE_DIRECTORY="" />\n`;
}
function polyConfig(a: ProvisionAccount): string {
  const attrs: Record<string, string> = {
    "reg.1.address": `${a.username}@${a.domain}`, "reg.1.auth.userId": a.username, "reg.1.auth.password": a.password,
    "reg.1.server.1.address": a.domain, "reg.1.server.1.port": "5060", "reg.1.displayName": a.label, "reg.1.label": "Redial",
  };
  return `<?xml version="1.0" standalone="yes"?>\n<PHONE_CONFIG>\n  <ALL ${Object.entries(attrs).map(([k, v]) => `${k}="${xmlEsc(v)}"`).join(" ")} />\n</PHONE_CONFIG>\n`;
}

// The file a phone asked for, or null when it isn't this phone's file.
export function provisionFile(vendor: string, file: string, a: ProvisionAccount): ProvisionFile {
  const f = file.toLowerCase();
  if (vendor === "grandstream" && f === `cfg${a.mac}.xml`) return { body: grandstream(a), type: "text/xml" };
  if (vendor === "yealink" && f === `${a.mac}.cfg`) return { body: yealink(a), type: "text/plain" };
  if (vendor === "poly" && f === `${a.mac}.cfg`) return { body: polyMaster(a), type: "text/xml" };
  if (vendor === "poly" && f === `${a.mac}-redial.cfg`) return { body: polyConfig(a), type: "text/xml" };
  return null;
}
