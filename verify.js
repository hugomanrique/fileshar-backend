const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

async function testEndpoints() {
  const baseURL = 'http://localhost:3000';

  console.log('--- Testing GET /clients ---');
  try {
    const res = await axios.get(`${baseURL}/clients?nombre=Test`);
    console.log('GET /clients status:', res.status);
    console.log('GET /clients data:', res.data);
  } catch (err) {
    if (err.response) {
       console.log('GET /clients error:', err.response.status, err.response.data);
    } else {
       console.log('GET /clients error:', err.message);
    }
  }

  console.log('\n--- Testing POST /upload ---');
  try {
    const form = new FormData();
    // Create a dummy file
    fs.writeFileSync('dummy.txt', 'This is a test file content.');
    form.append('archivo', fs.createReadStream('dummy.txt'));
    form.append('nombre', 'Hugo Test Client');
    form.append('identificacion', '123456789X');
    form.append('email', 'hugo@test.com');
    form.append('telefono', '1234567890');
    form.append('copias', '2');
    form.append('impresora', 'HP Laserjet');
    form.append('comentarios', 'Print double sided');
    form.append('tamanio', 'A4');

    const res = await axios.post(`${baseURL}/upload`, form, {
      headers: {
        ...form.getHeaders()
      }
    });

    console.log('POST /upload status:', res.status);
    console.log('POST /upload data:', res.data);
    
    // Clean up
    fs.unlinkSync('dummy.txt');
  } catch (err) {
     if (err.response) {
       console.log('POST /upload error:', err.response.status, err.response.data);
    } else {
       console.log('POST /upload error:', err.message);
    }
  }
}

testEndpoints();
