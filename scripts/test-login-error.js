// Test with better error handling
const testLogin = async () => {
    const baseUrl = 'https://www.getspotfunnel.com';
    const email = 'leo@getspotfunnel.com';
    const password = 'Walkergewert0!';

    console.log('🧪 Testing Production Login with Error Details');
    console.log('');

    try {
        // Get CSRF token
        const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`);
        const csrfData = await csrfResponse.json();
        console.log('✅ CSRF Token obtained');
        console.log('');

        // Attempt signin with redirect: manual to see response
        console.log('📡 Calling signin API...');
        const signinResponse = await fetch(`${baseUrl}/api/auth/signin/credentials`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                csrfToken: csrfData.csrfToken,
                email,
                password,
                callbackUrl: `${baseUrl}/dialer`,
                json: 'true'
            }),
            redirect: 'manual'
        });

        console.log('Response Status:', signinResponse.status);

        const location = signinResponse.headers.get('location');
        console.log('Redirect Location:', location);
        console.log('');

        if (location) {
            // Parse the redirect URL
            const url = new URL(location, baseUrl);
            console.log('Redirect Path:', url.pathname);
            console.log('Redirect Params:', Object.fromEntries(url.searchParams));

            if (url.searchParams.has('error')) {
                console.log('');
                console.log('❌ LOGIN FAILED');
                console.log('Error:', url.searchParams.get('error'));

                // Decode the error message
                const errorMsg = decodeURIComponent(url.searchParams.get('error') || '');
                console.log('');
                console.log('Decoded Error Message:');
                console.log(errorMsg);
            } else if (url.pathname === '/dialer') {
                console.log('✅ LOGIN SUCCESS - Redirected to /dialer');
            }
        }

    } catch (error) {
        console.error('❌ Exception:', error.message);
    }
};

testLogin();
