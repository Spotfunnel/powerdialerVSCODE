import fetch from 'node-fetch';

async function testLogin() {
    const baseUrl = 'http://localhost:9000';
    const email = 'leo@getspotfunnel.com';
    const password = 'Walkergewert0!';

    console.log('🧪 Testing Login Flow on', baseUrl);
    console.log('Email:', email);
    console.log('');

    try {
        // Step 1: Call NextAuth signin API
        console.log('📡 Step 1: Calling NextAuth signin API...');
        const response = await fetch(`${baseUrl}/api/auth/signin/credentials`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                email,
                password,
                callbackUrl: '/dialer',
                json: 'true'
            }),
            redirect: 'manual' // Don't follow redirects
        });

        console.log('Status:', response.status);
        console.log('Status Text:', response.statusText);
        console.log('Headers:', Object.fromEntries(response.headers.entries()));

        const text = await response.text();
        console.log('Response Body:', text);

        // Check for redirect
        const location = response.headers.get('location');
        if (location) {
            console.log('✅ Redirect Location:', location);
        } else {
            console.log('❌ No redirect header found');
        }

        // Check for cookies
        const setCookie = response.headers.get('set-cookie');
        if (setCookie) {
            console.log('🍪 Cookies set:', setCookie);
        } else {
            console.log('❌ No cookies set');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

testLogin();
