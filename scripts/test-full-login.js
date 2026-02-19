// Comprehensive production login test
const testLogin = async () => {
    const baseUrl = 'https://www.getspotfunnel.com';
    const email = 'leo@getspotfunnel.com';
    const password = 'Walkergewert0!';

    console.log('🧪 Testing Production Login Flow');
    console.log('Base URL:', baseUrl);
    console.log('Email:', email);
    console.log('');

    try {
        // Step 1: Get CSRF token
        console.log('📡 Step 1: Getting CSRF token...');
        const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`);
        const csrfData = await csrfResponse.json();
        console.log('CSRF Token:', csrfData.csrfToken);
        console.log('');

        // Step 2: Attempt signin
        console.log('📡 Step 2: Attempting signin...');
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

        console.log('Status:', signinResponse.status);
        console.log('Status Text:', signinResponse.statusText);

        const location = signinResponse.headers.get('location');
        if (location) {
            console.log('✅ Redirect Location:', location);

            if (location.includes('/dialer')) {
                console.log('✅ SUCCESS! Login redirected to /dialer');
            } else if (location.includes('/error')) {
                console.log('❌ FAILED! Redirected to error page');
                console.log('Error URL:', location);
            } else {
                console.log('⚠️  Unexpected redirect:', location);
            }
        } else {
            console.log('❌ No redirect - checking response body...');
            const text = await signinResponse.text();
            console.log('Response:', text.substring(0, 500));
        }

        // Step 3: Check session
        console.log('');
        console.log('📡 Step 3: Checking session...');
        const sessionResponse = await fetch(`${baseUrl}/api/auth/session`);
        const sessionData = await sessionResponse.json();

        if (sessionData.user) {
            console.log('✅ Session created!');
            console.log('User:', sessionData.user);
        } else {
            console.log('❌ No session created');
            console.log('Session data:', sessionData);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    }
};

testLogin();
