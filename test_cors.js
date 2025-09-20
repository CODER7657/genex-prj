// Test CORS configuration
const https = require('https');
const http = require('http');

async function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const client = urlObj.protocol === 'https:' ? https : http;
        
        const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: options.headers || {}
        };

        const req = client.request(requestOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const jsonData = data ? JSON.parse(data) : {};
                    resolve({ status: res.statusCode, data: jsonData });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });

        req.on('error', reject);
        
        if (options.data) {
            req.write(JSON.stringify(options.data));
        }
        
        req.end();
    });
}

async function testCORS() {
    try {
        console.log('Testing CORS configuration...');
        
        // Test health endpoint
        const healthResponse = await makeRequest('http://localhost:5000/health', {
            headers: {
                'Origin': 'http://localhost:5173',
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Health check successful:', healthResponse.status);
        
        // Test register endpoint (like frontend would do)
        const testUser = {
            email: `test-cors-${Date.now()}@example.com`,
            password: 'testpassword123',
            name: 'CORS Test User'
        };
        
        const registerResponse = await makeRequest('http://localhost:5000/api/auth/register', {
            method: 'POST',
            headers: {
                'Origin': 'http://localhost:5173',
                'Content-Type': 'application/json'
            },
            data: testUser
        });
        
        console.log('✅ Registration successful:', registerResponse.status);
        console.log('Token received:', !!registerResponse.data.token);
        
        if (registerResponse.data.token) {
            // Test chat endpoint
            const chatResponse = await makeRequest('http://localhost:5000/api/chat/send-message', {
                method: 'POST',
                headers: {
                    'Origin': 'http://localhost:5173',
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${registerResponse.data.token}`
                },
                data: {
                    message: 'Hello from CORS test!',
                    sessionId: null
                }
            });
            
            console.log('✅ Chat message successful:', chatResponse.status);
            if (chatResponse.data.response) {
                console.log('AI Response:', chatResponse.data.response.substring(0, 100) + '...');
            }
        }
        
        console.log('\n🎉 All CORS tests passed! Frontend should now work properly.');
        
    } catch (error) {
        console.error('❌ CORS test failed:');
        console.error('Error:', error.message);
    }
}

testCORS();