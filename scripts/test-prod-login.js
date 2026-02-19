// Test production login API
const testProductionLogin = async () => {
    const email = 'leo@getspotfunnel.com';
    const password = 'Walkergewert0!';

    console.log('🧪 Testing Production Login API');
    console.log('URL: https://www.getspotfunnel.com/api/auth/callback/credentials');
    console.log('Email:', email);
    console.log('');

    try {
        const response = await fetch('https://www.getspotfunnel.com/api/auth/callback/credentials', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email,
                password,
                csrfToken: 'test', // May need actual CSRF token
                callbackUrl: '/dialer',
                json: true
            })
        });

        console.log('Status:', response.status);
        console.log('Status Text:', response.statusText);

        const contentType = response.headers.get('content-type');
        console.log('Content-Type:', contentType);

        if (contentType?.includes('application/json')) {
            const data = await response.json();
            console.log('Response:', JSON.stringify(data, null, 2));
        } else {
            const text = await response.text();
            console.log('Response (first 500 chars):', text.substring(0, 500));
        }

    } catch (error) {
        console.error('❌ Error:', error);
    }
};

testProductionLogin();
