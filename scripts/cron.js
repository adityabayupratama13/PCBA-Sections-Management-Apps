const cron = require('node-cron');
const http = require('http');

console.log('[CRON] Starting Docker-bound cron agent... Schedule: 06:30 Daily');

// Run every day at 06:30 AM
// Format: minute hour day-of-month month day-of-week
cron.schedule('30 6 * * *', () => {
    console.log('[CRON] 06:30 Trigger activated! Requesting backend to synthesize and email Daily Report PDF...');
    
    // We hit the internal container on port 3002 (because this process runs inside the container)
    // Next.js API route will physically compile the PDF and send the email over SMTP
    const req = http.request(
      {
        host: 'localhost',
        port: 3000,
        path: '/api/cron/send-report',
        method: 'POST',
      },
      (res) => {
        let chunk = '';
        res.on('data', (d) => { chunk += d; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`[CRON] SUCCESS! Email sent. Host responded: ${chunk}`);
          } else {
            console.error(`[CRON] ERROR from host (${res.statusCode}): ${chunk}`);
          }
        });
      }
    );
    
    req.on('error', (err) => {
      console.error('[CRON] NETWORK ERROR:', err.message);
    });
    
    req.end();
}, {
    scheduled: true,
    timezone: "Asia/Jakarta" // GMT+7
});
