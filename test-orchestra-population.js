import fetch from 'node-fetch';

const API_URL = 'http://localhost:3001/api';
let authToken = '';

async function login() {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'admin@example.com',
      password: '123456'
    })
  });

  const data = await response.json();
  if (data.accessToken) {
    authToken = data.accessToken;
    console.log('✅ Login successful');
    return true;
  } else if (data.data?.accessToken) {
    authToken = data.data.accessToken;
    console.log('✅ Login successful (new format)');
    return true;
  }
  console.error('❌ Login failed:', data);
  return false;
}

async function testOrchestraPopulation() {
  // Get all orchestras
  const response = await fetch(`${API_URL}/orchestra`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  if (!response.ok) {
    console.error('❌ Failed to fetch orchestras:', response.status, response.statusText);
    return;
  }

  const orchestras = await response.json();
  console.log('\n📋 Found', orchestras.length, 'orchestra(s)');

  for (const orchestra of orchestras) {
    console.log('\n🎼 Orchestra:', orchestra.name);
    console.log('   ID:', orchestra._id);
    console.log('   Type:', orchestra.type);
    console.log('   Member IDs:', orchestra.memberIds);
    
    if (orchestra.members) {
      console.log('   ✅ Members field populated with', orchestra.members.length, 'student(s)');
      if (orchestra.members.length > 0) {
        console.log('   Sample member data:');
        const member = orchestra.members[0];
        console.log('     - ID:', member._id);
        console.log('     - Name:', member.personalInfo?.fullName);
        console.log('     - Instrument:', member.academicInfo?.mainInstrument);
      }
    } else {
      console.log('   ❌ Members field NOT populated (undefined or null)');
    }

    if (orchestra.conductor) {
      console.log('   ✅ Conductor populated:', orchestra.conductor.personalInfo?.fullName);
    } else {
      console.log('   Conductor ID:', orchestra.conductorId);
    }
  }

  // Test getting a specific orchestra by ID
  if (orchestras.length > 0) {
    console.log('\n\n🔍 Testing getOrchestraById for orchestra:', orchestras[0]._id);
    const singleResponse = await fetch(`${API_URL}/orchestra/${orchestras[0]._id}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (singleResponse.ok) {
      const orchestra = await singleResponse.json();
      console.log('🎼 Orchestra:', orchestra.name);
      if (orchestra.members) {
        console.log('✅ Members populated:', orchestra.members.length, 'student(s)');
      } else {
        console.log('❌ Members NOT populated');
      }
      if (orchestra.conductor) {
        console.log('✅ Conductor populated:', orchestra.conductor.personalInfo?.fullName);
      }
    }
  }
}

async function main() {
  console.log('🚀 Testing Orchestra API Population...\n');
  
  if (await login()) {
    await testOrchestraPopulation();
  }
  
  console.log('\n✨ Test complete!');
}

main().catch(console.error);