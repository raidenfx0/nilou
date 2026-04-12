const ids = ["10000111", "10000112", "10000114", "10000123", "10000125"];

const url = "https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/characters.json";
const r = await fetch(url, { headers: { "User-Agent": "NilouBot/1.0 (Discord Bot)" } });
const store = await r.json();

for (const id of ids) {
  const c = store[id];
  if (!c) {
    console.log(`${id} missing`);
    continue;
  }

  const keyList = Object.keys(c).slice(0, 12).join(",");
  const nameText = c.NameText ? c.NameText : "";
  const side = c.SideIconName ? c.SideIconName : "";
  const mapHash = c.NameTextMapHash ? c.NameTextMapHash : "";

  console.log(`${id} keys=${keyList}`);
  console.log(`${id} NameText=${nameText} NameTextMapHash=${mapHash} SideIconName=${side}`);
}
