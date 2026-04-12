const ids = [10000111, 10000112, 10000114, 10000123, 10000125];

for (const id of ids) {
  try {
    const r = await fetch(`https://gi.yatta.moe/api/v2/en/avatar/${id}`, {
      headers: { "User-Agent": "NilouBot/1.0 (Discord Bot)" },
    });

    if (!r.ok) {
      console.log(`${id} status=${r.status} name=N/A`);
      continue;
    }

    const j = await r.json();
    const name = j && j.data && j.data.name ? j.data.name : "N/A";
    console.log(`${id} status=${r.status} name=${name}`);
  } catch (e) {
    console.log(`${id} err=${e.message}`);
  }
}
