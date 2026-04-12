const ids = [10000111, 10000112, 10000114, 10000123, 10000125];

for (const id of ids) {
  const r = await fetch(`https://api.ambr.top/v2/en/avatar/${id}`, {
    headers: { "User-Agent": "NilouBot/1.0 (Discord Bot)" },
  });

  let name = "N/A";
  if (r.ok) {
    const j = await r.json();
    if (j) {
      if (j.data) {
        if (j.data.name) {
          name = j.data.name;
        }
      }
    }
  }

  console.log(`${id} status=${r.status} name=${name}`);
}
