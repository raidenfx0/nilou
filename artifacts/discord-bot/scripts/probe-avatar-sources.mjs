const id = 10000112;

const urls = [
  `https://api.ambr.top/v2/en/avatar/${id}`,
  `https://gi.yatta.moe/api/v2/en/avatar/${id}`,
  `https://genshin-db-api.vercel.app/api/v5/characters?id=${id}`,
  `https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/characters.json`,
  `https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/docs/store/characters.json`,
  `https://raw.githubusercontent.com/Dimbreath/AnimeGameData/master/ExcelBinOutput/AvatarExcelConfigData.json`
];

for (const url of urls) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": "NilouBot/1.0 (Discord Bot)", "Accept": "application/json" } });
    const text = await r.text();
    console.log(`\n${url}`);
    console.log(`status=${r.status} ok=${r.ok} len=${text.length}`);
    console.log(text.slice(0, 140).replace(/\s+/g, " "));
  } catch (e) {
    console.log(`\n${url}`);
    console.log(`err=${e.message}`);
  }
}
