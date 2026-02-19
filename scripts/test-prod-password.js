// Test password verification via admin endpoint
const testPassword = async () => {
    const url = 'https://www.getspotfunnel.com/api/admin/test-password';

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            email: 'leo@getspotfunnel.com',
            password: 'Walkergewert0!',
            adminPassword: 'Walkergewert0!' // Same as ADMIN_PASSWORD in .env
        })
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (data.passwordMatch === false) {
        console.log('');
        console.log('❌ PASSWORD DOES NOT MATCH IN PRODUCTION');
        console.log('This means the password hash in production database is different');
    } else if (data.passwordMatch === true) {
        console.log('');
        console.log('✅ PASSWORD MATCHES - Auth logic issue, not password');
    }
};

testPassword();
