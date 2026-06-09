async function test() {
  const res = await fetch('http://localhost:3000/api/admin/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ facilityId: '2a39a2be-70fa-4009-bfad-523194a34bde', activeProvider: 'auto', userKeys: { groqKey: 'test' } })
  });
  console.log(res.status, await res.text());
}
test();
