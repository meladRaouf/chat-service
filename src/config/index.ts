import dotenv from 'dotenv';
import path from 'path';

// Determine the correct path to .env based on runtime environment
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });


const config = {
    port: process.env.PORT || 5050,
    mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/chat_default',
    corsOrigin: process.env.CORS_ORIGIN || '*',
    // Store multiple auth service URLs
    authServiceUrls: {
        NFG_PARTNER_BANK: process.env.AUTH_SERVICE_URL_NFG_PARTNER_BANK || '',
        NFG_CLIENT_PORTAL: process.env.AUTH_SERVICE_URL_NFG_CLIENT_PORTAL || '',
        // Add more mappings here if needed
    },
};

// Validate essential configuration
if (!config.mongodbUri) {
    console.error("FATAL ERROR: MONGODB_URI is not defined in .env file.");
    process.exit(1);
}
// Validate that URLs are defined for the known contextApps
if (!config.authServiceUrls.NFG_PARTNER_BANK) {
    console.error("FATAL ERROR: AUTH_SERVICE_URL_NFG_PARTNER_BANK is not defined in .env file.");
    process.exit(1);
}
 if (!config.authServiceUrls.NFG_CLIENT_PORTAL) {
    console.error("FATAL ERROR: AUTH_SERVICE_URL_NFG_CLIENT_PORTAL is not defined in .env file.");
    process.exit(1);
}


export default config;
