# Setting Up Google Cloud Speech-to-Text API

This document provides instructions on how to set up Google Cloud Speech-to-Text API for use with this application.

## Prerequisites

- A Google Cloud account
- A Google Cloud project
- Billing enabled on your Google Cloud project

## Steps to Set Up Google Cloud Speech-to-Text API

### 1. Create a Google Cloud Project (if you don't have one already)

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top of the page
3. Click on "New Project"
4. Enter a name for your project and click "Create"

### 2. Enable the Speech-to-Text API

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to "APIs & Services" > "Library"
4. Search for "Speech-to-Text API"
5. Click on "Speech-to-Text API"
6. Click "Enable"

### 3. Create a Service Account

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to "IAM & Admin" > "Service Accounts"
4. Click "Create Service Account"
5. Enter a name for your service account (e.g., "speech-to-text-service")
6. Click "Create and Continue"
7. For the role, select "Cloud Speech Admin" (or a more restrictive role if needed)
8. Click "Continue"
9. Click "Done"

### 4. Create a Service Account Key

1. In the Service Accounts list, find the service account you just created
2. Click on the three dots in the "Actions" column
3. Click "Manage keys"
4. Click "Add Key" > "Create new key"
5. Select "JSON" as the key type
6. Click "Create"
7. The key file will be downloaded to your computer

### 5. Configure the Application

You have two options to configure the application to use your Google Cloud credentials:

#### Option 1: Using Environment Variables

Add the following environment variables to your `.env.local` file:

```
GOOGLE_PROJECT_ID=your-project-id
GOOGLE_CLIENT_EMAIL=your-service-account-email@your-project-id.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here...\n-----END PRIVATE KEY-----\n"
```

Replace the values with the actual values from your service account key file.

#### Option 2: Using a Service Account Key File

1. Place your service account key file in a secure location
2. Add the following environment variable to your `.env.local` file:

```
GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/service-account-key.json
```

Replace `/path/to/your/service-account-key.json` with the actual path to your service account key file.

## Testing the Integration

1. Start the application with `npm run dev`
2. Navigate to the application in your browser
3. Select "Google Speech" as the Speech-to-Text API
4. Click the microphone button to start recording
5. Speak into your microphone
6. The transcribed text should appear in the input field

## Troubleshooting

If you encounter any issues with the Google Cloud Speech-to-Text API integration, check the following:

1. Make sure the Speech-to-Text API is enabled for your project
2. Make sure your service account has the correct permissions
3. Make sure your credentials are correctly configured in the application
4. Check the browser console and server logs for any error messages

For more information, see the [Google Cloud Speech-to-Text API documentation](https://cloud.google.com/speech-to-text/docs). 