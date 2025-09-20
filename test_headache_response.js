// Test improved AI response for headache complaint
const http = require('http');

async function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const client = http;
        
        const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 5000),
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

async function testHeadacheResponse() {
    try {
        console.log('🧪 Testing Improved AI Response for Headache Complaint\n');

        // Step 1: Register anonymous user
        const userData = {
            age: 19,
            anonymous: true,
            termsAccepted: true
        };

        const registerResponse = await makeRequest('http://localhost:5000/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Origin': 'http://localhost:5173'
            },
            data: userData
        });

        if (registerResponse.status !== 201) {
            console.log('❌ Registration failed');
            return;
        }

        const token = registerResponse.data.tokens.accessToken;
        console.log('✅ User registered successfully\n');

        // Step 2: Send headache message
        const headacheMessage = {
            message: "I'm having a really bad headache and it's making me feel awful"
        };

        console.log('📤 Sending message: "' + headacheMessage.message + '"\n');

        const chatResponse = await makeRequest('http://localhost:5000/api/chat/message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Origin': 'http://localhost:5173'
            },
            data: headacheMessage
        });

        if (chatResponse.status === 200) {
            const response = chatResponse.data.data;
            console.log('🤖 AI Response:');
            console.log('━'.repeat(50));
            console.log(response.aiResponse.content);
            console.log('━'.repeat(50));
            console.log('\n📊 Response Analysis:');
            console.log('• Source:', response.aiResponse.source);
            console.log('• Sentiment detected:', response.aiResponse.sentiment?.label);
            console.log('• Crisis detected:', response.aiResponse.crisisDetected);
            
            if (response.aiResponse.recommendations && response.aiResponse.recommendations.length > 0) {
                console.log('\n💡 Recommendations provided:', response.aiResponse.recommendations.length);
            }

            // Check if response mentions headache specifically
            const content = response.aiResponse.content.toLowerCase();
            const empathyCheck = content.includes('sorry') || content.includes('understand') || content.includes('hear');
            const headacheCheck = content.includes('headache') || content.includes('pain');
            const helpfulCheck = content.includes('stress') || content.includes('rest') || content.includes('help');

            console.log('\n✅ Response Quality Check:');
            console.log('• Shows empathy:', empathyCheck ? '✅ Yes' : '❌ No');
            console.log('• Addresses headache:', headacheCheck ? '✅ Yes' : '❌ No');
            console.log('• Offers helpful insights:', helpfulCheck ? '✅ Yes' : '❌ No');
            
            if (empathyCheck && headacheCheck && helpfulCheck) {
                console.log('\n🎉 IMPROVED RESPONSE QUALITY: Excellent empathy and support!');
            } else if (empathyCheck && headacheCheck) {
                console.log('\n👍 GOOD RESPONSE QUALITY: Shows care and understanding');
            } else {
                console.log('\n⚠️ RESPONSE NEEDS IMPROVEMENT: Could be more empathetic or specific');
            }

        } else {
            console.log('❌ Chat request failed with status:', chatResponse.status);
            console.log('Response:', chatResponse.data);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testHeadacheResponse();