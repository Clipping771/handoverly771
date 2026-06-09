async function run() {
  try {
    const res = await fetch("https://rqbkoryrlkglgsnqonvf.supabase.co/rest/v1/", {
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxYmtvcnlybGtnbGdzbnFvbnZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3OTE2NDEsImV4cCI6MjA5NjM2NzY0MX0.mqp50AJbXOw-6lsRHC6fnm8R2Elrdf0E4PjQBlV4N04'
      }
    });
    console.log("Status:", res.status);
    console.log("Headers:");
    for (const [key, value] of res.headers.entries()) {
      console.log(`${key}: ${value}`);
    }
  } catch (err) {
    console.error(err);
  }
}
run();
