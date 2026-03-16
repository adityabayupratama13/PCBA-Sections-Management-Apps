async function test() {
  const res = await fetch('http://localhost:3000/api/attendance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      member_name: 'Aditya Bayu Pratama',
      date: '2026-03-16',
      shift: 'Off',
      ot_start_time: '18:00',
      ot_end_time: '20:00',
      overtime_hours: 2,
      overtime_desc: 'Testing API call',
      userName: 'Aditya Bayu Pratama'
    })
  });
  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Response:", text);
}
test();
