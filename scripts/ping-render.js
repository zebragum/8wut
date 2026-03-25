const check = async () => {
  try {
    const res = await fetch('https://eightwut-api.onrender.com/auth/migrate-reports');
    const text = await res.text();
    console.log(new Date().toLocaleTimeString(), text);
    if (text.includes('Migration applied')) {
      console.log('✅ Remote DB successfully migrated. Feed restored.');
      process.exit(0);
    }
  } catch (e) {
    console.log(e.message);
  }
  setTimeout(check, 5000);
};
console.log('Waiting for Render deployment to finish and pinging DB migration route...');
check();
