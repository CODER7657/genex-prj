const axios = require('axios');

async function simpleTest() {
  try {
    // Simple registration test
    const response = await axios.post('http://localhost:5000/api/auth/register', {
      age: 25,
      anonymous: true,
      termsAccepted: true
    });
    
    console.log('Registration successful:', response.data);
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

simpleTest();