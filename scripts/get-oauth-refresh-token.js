// scripts/get-oauth-refresh-token.js
// Helper script to get OAuth 2.0 refresh token for Office365/Outlook
// Usage: node scripts/get-oauth-refresh-token.js

import axios from 'axios';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function getRefreshToken() {
  console.log('=== Office365 OAuth 2.0 Refresh Token Generator ===\n');
  
  const clientId = await question('Enter your Azure AD Application (Client) ID: ');
  const clientSecret = await question('Enter your Azure AD Client Secret: ');
  const tenantId = await question('Enter your Tenant ID (or press Enter for "common"): ') || 'common';
  const email = await question('Enter your email address (e.g., soporte@lcc.com.mx): ');
  
  // Step 1: Get authorization URL
  const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` +
    `client_id=${encodeURIComponent(clientId)}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent('http://localhost')}` +
    `&response_mode=query` +
    `&scope=${encodeURIComponent('https://outlook.office365.com/Mail.Send offline_access')}` +
    `&login_hint=${encodeURIComponent(email)}`;
  
  console.log('\n=== Step 1: Authorize Application ===');
  console.log('1. Open this URL in your browser:');
  console.log(authUrl);
  console.log('\n2. Sign in with your Microsoft account');
  console.log('3. Grant permissions');
  console.log('4. After redirect, copy the "code" parameter from the URL');
  console.log('   Example: http://localhost/?code=AUTHORIZATION_CODE_HERE');
  
  const code = await question('\nEnter the authorization code from the redirect URL: ');
  
  // Step 2: Exchange code for tokens
  console.log('\n=== Step 2: Exchanging Code for Tokens ===');
  
  try {
    const tokenResponse = await axios.post(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: 'http://localhost',
        grant_type: 'authorization_code',
        scope: 'https://outlook.office365.com/Mail.Send offline_access'
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    console.log('\n✅ Success! Tokens received\n');
    console.log('=== Add these to your .env file ===\n');
    console.log(`OAUTH_CLIENT_ID=${clientId}`);
    console.log(`OAUTH_CLIENT_SECRET=${clientSecret}`);
    console.log(`OAUTH_REFRESH_TOKEN=${tokenResponse.data.refresh_token}`);
    console.log(`SMTP_USER=${email}`);
    console.log(`SMTP_AUTH_TYPE=oauth2`);
    console.log('\nOptional (will be auto-refreshed):');
    console.log(`OAUTH_ACCESS_TOKEN=${tokenResponse.data.access_token}`);
    console.log(`OAUTH_ACCESS_TOKEN_EXPIRES=${Date.now() + (tokenResponse.data.expires_in * 1000)}`);
    console.log('\n✅ OAuth 2.0 setup complete!');
    
  } catch (error) {
    console.error('\n❌ Error getting tokens:', error.response?.data || error.message);
    console.log('\nTroubleshooting:');
    console.log('- Make sure the authorization code is correct');
    console.log('- Check that client ID and secret are correct');
    console.log('- Verify API permissions are granted in Azure AD');
  }
  
  rl.close();
}

getRefreshToken().catch(console.error);
